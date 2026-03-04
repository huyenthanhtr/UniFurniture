import { Component, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Header } from './shared/header/header';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';
import { AuthModal } from './shared/auth-modal/auth-modal';
import { CartPopup } from './shared/cart-popup/cart-popup';
import { ContactFloat } from './shared/contact-float/contact-float';
import { Homepage } from './pages/homepage/homepage';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Header, Navbar, Footer, AuthModal, CartPopup, ContactFloat, Homepage],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('client');

  constructor(private router: Router) {}

  isRouteActive(path: string): boolean {
    return this.router.url.includes(path);
  }
}