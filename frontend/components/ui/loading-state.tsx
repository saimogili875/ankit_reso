import React from 'react';
import { Card } from './card';

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading content...' }) => {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center glass-card border border-border">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <h1 className="text-sm text-foreground font-medium">{message}</h1>
    </Card>
  );
};
