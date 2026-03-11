import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  onClick?: () => void;
}

export function StatsCard({ 
  title, 
  value, 
  icon, 
  trend,
  color = 'blue',
  onClick 
}: StatsCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      text: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      text: 'text-green-600'
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      text: 'text-red-600'
    },
    yellow: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      text: 'text-yellow-600'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      text: 'text-purple-600'
    },
    gray: {
      bg: 'bg-gray-50',
      icon: 'text-gray-600',
      text: 'text-gray-600'
    }
  }[color];

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-4 ${
        onClick ? 'active:bg-gray-50 cursor-pointer' : ''
      } transition-colors touch-manipulation`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
          
          {trend && (
            <div className="flex items-center gap-1">
              {trend.value > 0 ? (
                <TrendingUp size={16} className="text-green-600" />
              ) : trend.value < 0 ? (
                <TrendingDown size={16} className="text-red-600" />
              ) : null}
              <span className={`text-sm font-medium ${
                trend.value > 0 ? 'text-green-600' : 
                trend.value < 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-sm text-gray-600 ml-1">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        
        {icon && (
          <div className={`w-12 h-12 ${colorClasses.bg} rounded-lg flex items-center justify-center ${colorClasses.icon} flex-shrink-0`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
