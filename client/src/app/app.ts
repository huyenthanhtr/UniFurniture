import { Component, signal, inject, AfterViewInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { UiStateService } from './shared/ui-state.service';
import { createChat } from '@n8n/chat';
import '@n8n/chat/style.css';
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
export class App implements AfterViewInit {
  ui = inject(UiStateService);
  protected readonly title = signal('client');

  constructor(private router: Router) { }

  ngAfterViewInit(): void {
    createChat({
      webhookUrl: 'https://ai-agent.nocoai.vn/webhook/11651f7b-1a3d-400d-904b-5490abaac2bf/chat',
      target: '#n8n-chat-container',
      mode: 'fullscreen',
      showWelcomeScreen: true,
      initialMessages: [
        'Chào bạn! 👋',
        'Tôi là trợ lý ảo UniFurniture. Tôi có thể giúp gì cho bạn hôm nay?'
      ],
      i18n: {
        en: {
          title: 'Uni AI',
          inputPlaceholder: 'Nhập tin nhắn của bạn...',
          subtitle: ' ',
          footer: 'Powered by UniFurniture AR',
          getStarted: 'Bắt đầu ngay',
          closeButtonTooltip: 'Đóng cửa sổ Chat',
        }
      }
    });
  }

  isRouteActive(path: string): boolean {
    return this.router.url.includes(path);
  }
}