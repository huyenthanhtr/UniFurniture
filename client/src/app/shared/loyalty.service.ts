import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

export interface LoyaltySummary {
  loyalty_points_lifetime: number;
  membership_tier: 'dong' | 'bac' | 'vang' | 'kim_cuong';
  membership_tier_label: string;
  next_tier: 'dong' | 'bac' | 'vang' | 'kim_cuong' | null;
  next_tier_label: string | null;
  points_to_next_tier: number;
  estimated_points_for_order: number;
  tier_achieved_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private readonly http = inject(HttpClient);

  async getProfileLoyalty(profileId: string): Promise<LoyaltySummary | null> {
    const id = String(profileId || '').trim();
    if (!id) return null;
    try {
      const res = await firstValueFrom(
        this.http.get<LoyaltySummary>(`${API_BASE_URL}/loyalty/profiles/${id}`)
      );
      return res || null;
    } catch {
      return null;
    }
  }

  async estimatePoints(orderValue: number): Promise<number> {
    const safe = Math.max(0, Math.floor(Number(orderValue || 0)));
    try {
      const res = await firstValueFrom(
        this.http.get<{ estimated_points_for_order?: number }>(`${API_BASE_URL}/loyalty/estimate`, {
          params: { orderValue: String(safe) },
        })
      );
      return Math.max(0, Math.floor(Number(res?.estimated_points_for_order || 0)));
    } catch {
      return Math.max(0, Math.floor(safe / 10000));
    }
  }
}

