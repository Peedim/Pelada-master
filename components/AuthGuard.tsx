import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  isAdminRoute?: boolean;
  currentUserAdmin?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, isAdminRoute, currentUserAdmin }) => {
  // Se a rota for de Admin, mas o usuário não for admin
  if (isAdminRoute && !currentUserAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8 text-center bg-slate-800 rounded-xl border border-red-900/50 m-4 animate-fade-in">
        <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Acesso Restrito</h3>
        <p className="text-slate-400">Você não tem permissão para acessar esta área de administrador.</p>
      </div>
    );
  }

  // Caso contrário, renderiza o conteúdo normal
  return <>{children}</>;
};

export default AuthGuard;