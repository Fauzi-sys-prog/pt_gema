import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface MobileCardProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    color: string;
  };
  icon?: ReactNode;
  onClick?: () => void;
  details?: { label: string; value: string | ReactNode }[];
  actions?: ReactNode;
}

export function MobileCard({ 
  title, 
  subtitle, 
  badge, 
  icon, 
  onClick, 
  details,
  actions 
}: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-4 ${
        onClick ? 'active:bg-gray-50 cursor-pointer' : ''
      } transition-colors touch-manipulation`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            {icon}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{title}</h3>
              {subtitle && (
                <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
              )}
            </div>
            
            {badge && (
              <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                {badge.text}
              </span>
            )}
          </div>

          {details && details.length > 0 && (
            <div className="mt-3 space-y-2">
              {details.map((detail, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{detail.label}</span>
                  <span className="font-medium text-gray-900">{detail.value}</span>
                </div>
              ))}
            </div>
          )}

          {actions && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {actions}
            </div>
          )}
        </div>

        {onClick && (
          <ChevronRight className="flex-shrink-0 text-gray-400" size={20} />
        )}
      </div>
    </div>
  );
}
