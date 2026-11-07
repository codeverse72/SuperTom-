/**
 * React Hook for Feature Availability
 */

import { useCallback } from 'react';
import { FeatureId, FeatureStatus } from '../types/feature';
import { 
  getFeatureStatus, 
  getFeatureUnavailableMessage, 
  isFeatureAvailable 
} from '../config/featureConfig';

export function useFeature(featureId: FeatureId) {
  const status: FeatureStatus = getFeatureStatus(featureId);
  const isAvailable: boolean = isFeatureAvailable(featureId);
  const unavailableMessage: string = getFeatureUnavailableMessage(featureId);

  const requireAvailable = useCallback((onAvailable: () => void, onUnavailable?: (msg: string) => void) => {
    if (isAvailable) {
      onAvailable();
    } else {
      if (onUnavailable) {
        onUnavailable(unavailableMessage);
      }
    }
  }, [isAvailable, unavailableMessage]);

  return {
    status,
    isAvailable,
    unavailableMessage,
    requireAvailable
  };
}
