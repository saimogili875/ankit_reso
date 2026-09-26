import React from 'react';
import { Card } from './card';

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading content...' }) => {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{message}</p>
    </Card>
  );
};
