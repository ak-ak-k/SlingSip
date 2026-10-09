using System;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;
using System.Text;

// A test-only helper. The application does not depend on .NET or native pointer injection.
public static class DesktopTestPointer {
  [StructLayout(LayoutKind.Sequential)]
  public struct Point { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)]
  public struct MouseInput {
    public int Dx; public int Dy;
    public uint MouseData; public uint Flags; public uint Time;
    public UIntPtr ExtraInfo;
  }
  [StructLayout(LayoutKind.Explicit)]
  public struct InputUnion { [FieldOffset(0)] public MouseInput Mouse; }
  [StructLayout(LayoutKind.Sequential)]
  public struct Input { public uint Type; public InputUnion Data; }

  [DllImport("user32.dll")]
  public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint SendInput(uint count, Input[] inputs, int size);
  [DllImport("user32.dll")]
  private static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")]
  private static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll", SetLastError = true)]
  private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", SetLastError = true)]
  private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
  [DllImport("user32.dll")]
  private static extern bool CloseDesktop(IntPtr desktop);
  [DllImport("user32.dll")]
  private static extern IntPtr GetThreadDesktop(uint threadId);
  [DllImport("kernel32.dll")]
  private static extern uint GetCurrentThreadId();
  [DllImport("user32.dll", EntryPoint = "GetUserObjectInformationW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool GetUserObjectInformation(IntPtr handle, int index, StringBuilder value, int length, out int needed);

  private static string DesktopName(IntPtr desktop) {
    var name = new StringBuilder(256); int needed;
    return GetUserObjectInformation(desktop, 2, name, name.Capacity * 2, out needed) ? name.ToString() : "unavailable";
  }
  // Diagnose an unavailable input desktop without switching desktops or bypassing a lock.
  private static string DesktopInfo() {
    IntPtr input = OpenInputDesktop(0, false, 0x0001);
    int error = Marshal.GetLastWin32Error();
    string thread = DesktopName(GetThreadDesktop(GetCurrentThreadId()));
    if (input == IntPtr.Zero) return "Input desktop unavailable (Win32 " + error + "); thread desktop: " + thread;
    try { return "Input desktop: " + DesktopName(input) + "; thread desktop: " + thread; }
    finally { CloseDesktop(input); }
  }

  private static void Click(int x, int y, uint ownerPid) {
    Point point;
    if (!GetCursorPos(out point)) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (Math.Abs(point.X - x) > 1 || Math.Abs(point.Y - y) > 1)
      throw new InvalidOperationException("Physical pointer moved before Click; no input was injected.");
    IntPtr root = GetAncestor(WindowFromPoint(point), 2); uint actualPid = 0;
    if (root == IntPtr.Zero || GetWindowThreadProcessId(root, out actualPid) == 0 || actualPid != ownerPid)
      throw new InvalidOperationException("Click target is not owned by the isolated QA process (expected PID " + ownerPid + ", actual PID " + actualPid + " at " + point.X + "," + point.Y + "); no input was injected.");
    Input[] inputs = new Input[2];
    inputs[0].Data.Mouse.Flags = 0x0002;
    inputs[1].Data.Mouse.Flags = 0x0004;
    if (SendInput(2, inputs, Marshal.SizeOf(typeof(Input))) != 2)
      throw new Win32Exception(Marshal.GetLastWin32Error());
  }

  public static int Main(string[] args) {
    try {
      SetThreadDpiAwarenessContext(new IntPtr(-4));
      string action = args.Length > 0 ? args[0] : "Position";
      if (action == "Desktop") { Console.WriteLine(DesktopInfo()); return 0; }
      if (action != "Position" && action != "Move" && action != "Click")
        throw new ArgumentException("Unknown pointer test action.");
      if (action != "Position") {
        if (args.Length != (action == "Click" ? 4 : 3)) throw new ArgumentException("A pointer position and isolated owner for Click are required.");
        int x = Int32.Parse(args[1], CultureInfo.InvariantCulture);
        int y = Int32.Parse(args[2], CultureInfo.InvariantCulture);
        if (!SetCursorPos(x, y)) throw new Win32Exception(Marshal.GetLastWin32Error());
        Thread.Sleep(150);
        if (action == "Click") Click(x, y, UInt32.Parse(args[3], CultureInfo.InvariantCulture));
      }
      Point point;
      if (!GetCursorPos(out point)) throw new Win32Exception(Marshal.GetLastWin32Error());
      Console.WriteLine("{\"x\":" + point.X + ",\"y\":" + point.Y + "}");
      return 0;
    } catch (Exception error) {
      Console.Error.WriteLine(error.Message);
      Console.Error.WriteLine(DesktopInfo());
      return 1;
    }
  }
}
