import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-community-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './community.html',
  styleUrl: './community.css',
})
export class CommunityPageComponent {}
