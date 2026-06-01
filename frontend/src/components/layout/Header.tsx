import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Menu, UserCircle2 } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-[60] relative h-[72px] flex-shrink-0 overflow-hidden cursor-pointer"
      style={{
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        minWidth: '320px'
      }}
      onClick={() => navigate('/')}
      role="button"
      aria-label="Ir para Início"
    >
      {/* Imagem do header com cache-busting */}
      <img
        src="/header-banner.png?v=2"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
        style={{ minWidth: '100%' }}
      />

      {/* Controles flutuantes sobre a imagem */}
      <div className="absolute inset-0 flex items-center justify-between px-4 lg:px-8 xl:px-10 2xl:px-12">
        {/* Botão Menu Mobile - Esquerda */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden text-white hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Espaçador para empurrar o menu do usuário para a direita */}
        <div className="hidden lg:block" />

        {/* Menu do usuário - Direita (impede propagação para não navegar para Home) */}
        <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="group flex items-center gap-4 text-white hover:bg-white/10">
              {user?.foto_perfil ? (
                <img
                  src={user.foto_perfil}
                  alt={user.name}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30 transition-all duration-300 ease-out group-hover:ring-white/70 group-hover:brightness-110 group-hover:scale-110"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <User className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-sm">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={16}>
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              <span>{user?.email}</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">
                Perfil: {user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'MANAGER' ? 'Gestor' : 'Visualizador'}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <UserCircle2 className="mr-2 h-4 w-4" />
              <span>Visualizar Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}