import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, subtext, icon }) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col justify-between hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        {icon && <div className="text-green-500">{icon}</div>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-white">{value}</span>
        {subtext && <span className="text-slate-500 text-xs mb-1">{subtext}</span>}
      </div>
    </div>
  );
};

export default StatsCard;