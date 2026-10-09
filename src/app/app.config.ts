import { inject, provideAppInitializer, provideZonelessChangeDetection, type ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { DesktopService } from './core/services/desktop.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideAppInitializer(() => inject(DesktopService).initialize()),
  ],
};
