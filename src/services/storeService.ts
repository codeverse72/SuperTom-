/**
 * Biscuit Store & Inventory Service
 */

import { apiClient } from './apiClient';
import { ApiResponse, BiscuitInventoryDto, BiscuitProductDto, PurchaseBiscuitRequest, PurchaseBiscuitResponse } from './types';

export const storeService = {
  getBiscuits: async (): Promise<ApiResponse<BiscuitProductDto[]>> => {
    return apiClient.get<BiscuitProductDto[]>('/store/biscuits');
  },
  getInventory: async (): Promise<ApiResponse<BiscuitInventoryDto>> => {
    return apiClient.get<BiscuitInventoryDto>('/store/inventory');
  },
  purchaseBiscuit: async (req: PurchaseBiscuitRequest): Promise<ApiResponse<PurchaseBiscuitResponse>> => {
    return apiClient.post<PurchaseBiscuitResponse>('/store/purchase', req);
  },
  feedBiscuit: async (biscuitId: string, count: number = 1): Promise<ApiResponse<{ newProductionRate: number; newInventory: BiscuitInventoryDto }>> => {
    return apiClient.post<{ newProductionRate: number; newInventory: BiscuitInventoryDto }>('/store/feed', { biscuitId, count });
  }
};
