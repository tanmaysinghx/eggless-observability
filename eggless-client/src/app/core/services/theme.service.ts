import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<Theme>('dark');
  public theme$: Observable<Theme> = this.themeSubject.asObservable();

  constructor() {
    const savedTheme = localStorage.getItem('eggless_theme') as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('dark');
    }
  }

  public get currentTheme(): Theme {
    return this.themeSubject.value;
  }

  public toggleTheme(): void {
    const nextTheme = this.themeSubject.value === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  public setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    localStorage.setItem('eggless_theme', theme);

    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }
}
