import * as React from 'react';
import { toast as sonnerToast } from 'sonner';

// Mantém a tipagem parecida com o original para não quebrar componentes existentes
export type ToastProps = {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive' | null;
  action?: React.ReactNode;
  [key: string]: any;
};

export function toast(props: ToastProps) {
  // Remove títulos genéricos, preferindo sempre exibir a descrição
  const message = props.description || props.title;
  
  if (props.variant === 'destructive') {
    const id = sonnerToast.error(message as any);
    return { id, dismiss: () => sonnerToast.dismiss(id), update: () => {} };
  }
  
  const id = sonnerToast.success(message as any);
  return { id, dismiss: () => sonnerToast.dismiss(id), update: () => {} };
}

export function useToast() {
  return {
    toasts: [] as any[],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}
