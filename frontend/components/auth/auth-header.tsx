import React from 'react';
import { GraduationCap, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface AuthHeaderProps {
  title: string;
  subtitle: string;
  isAdmin?: boolean;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ title, subtitle, isAdmin = false }) => {
  return (
    <div className="space-y-4 text-center sm:text-left">
      {/* Brand Header & Role Badge */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-blue-400/30">
            {isAdmin ? <Shield className="w-5 h-5 text-indigo-100" /> : <GraduationCap className="w-5 h-5 text-white" />}
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1">
              ANKIT <span className="text-blue-500">JEE</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block -mt-1">
              {isAdmin ? 'ADMIN PORTAL' : 'STUDENT PORTAL'}
            </span>
          </div>
        </div>

        {isAdmin ? (
          <Badge variant="purple" className="bg-purple-950/60 text-purple-300 border-purple-800/60 px-3 py-1">
            🔒 Secure Admin Gateway
          </Badge>
        ) : (
          <Badge variant="blue" className="bg-blue-950/60 text-blue-300 border-blue-800/60 px-3 py-1">
            JEE Main & Advanced 2025
          </Badge>
        )}
      </div>

      {/* Title & Subtitle */}
      <div className="space-y-1 pt-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
};
