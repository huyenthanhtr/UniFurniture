import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/header/header';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';
import { AuthModal } from './shared/auth-modal/auth-modal';
import { CartPopup } from './shared/cart-popup/cart-popup';
import { ContactFloat } from './shared/contact-float/contact-float';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Navbar, Footer, AuthModal, CartPopup, ContactFloat],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('client');
}
