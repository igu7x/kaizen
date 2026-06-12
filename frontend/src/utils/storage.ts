/**
 * Utilitário para gerenciar localStorage de forma simples e segura
 *
 * Uso:
 * - Storage.save('chave', dados)
 * - Storage.load('chave', valorPadrao)
 * - Storage.remove('chave')
 * - Storage.clear()
 */

import { useState, useEffect } from "react";

export class Storage {
  /**
   * Salva dados no localStorage
   * @param key - Chave para identificar os dados
   * @param data - Dados a serem salvos (qualquer tipo serializável)
   * @returns true se salvou com sucesso, false caso contrário
   */
  static save<T>(key: string, data: T): boolean {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Carrega dados do localStorage
   * @param key - Chave dos dados a serem carregados
   * @param defaultValue - Valor padrão se a chave não existir
   * @returns Os dados salvos ou o valor padrão
   */
  static load<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * Remove dados do localStorage
   * @param key - Chave dos dados a serem removidos
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  }

  /**
   * Limpa todos os dados do localStorage
   */
  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  }

  /**
   * Verifica se uma chave existe no localStorage
   * @param key - Chave a ser verificada
   * @returns true se a chave existe, false caso contrário
   */
  static has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }

  /**
   * Retorna todas as chaves armazenadas
   * @returns Array com todas as chaves
   */
  static keys(): string[] {
    return Object.keys(localStorage);
  }

  /**
   * Retorna o número de itens armazenados
   * @returns Número de itens
   */
  static size(): number {
    return localStorage.length;
  }
}

/**
 * Hook React para usar localStorage com estado reativo
 *
 * Uso:
 * const [dados, setDados] = useLocalStorage('chave', valorInicial);
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  // Estado para armazenar o valor
  const [storedValue, setStoredValue] = useState<T>(() => {
    return Storage.load(key, initialValue);
  });

  // Atualiza o localStorage quando o valor muda
  useEffect(() => {
    Storage.save(key, storedValue);
  }, [key, storedValue]);

  // Função para atualizar o valor
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Permite passar uma função como no useState normal
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  return [storedValue, setValue];
}

// Exporta como default também
export default Storage;
