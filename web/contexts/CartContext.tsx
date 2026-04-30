'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { addCartItem, getCart, removeCartItem, type Cart } from '@/lib/api/cart';
import { getToken } from '@/lib/auth/session';

interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  isOpen: boolean;
  organizationSlug: string | null;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  refreshCart: (orgId: number, orgSlug?: string) => Promise<void>;
  addWorkshop: (orgId: number, workshopId: number, orgSlug?: string) => Promise<Cart>;
  removeItem: (orgId: number, itemId: number) => Promise<void>;
  updateCart: (cart: Cart) => void;
  clearCart: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_ORG_KEY = 'wayfield_cart_org';

function persistCartOrg(orgId: number, orgSlug: string): void {
  try {
    localStorage.setItem(CART_ORG_KEY, JSON.stringify({ id: orgId, slug: orgSlug }));
  } catch {}
}

function clearPersistedCartOrg(): void {
  try {
    localStorage.removeItem(CART_ORG_KEY);
  } catch {}
}

function getPersistedCartOrg(): { id: number; slug: string } | null {
  try {
    const raw = localStorage.getItem(CART_ORG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { id: number; slug: string };
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);
  const lastOrgId = useRef<number | null>(null);

  const refreshCart = useCallback(async (orgId: number, orgSlug?: string) => {
    if (!getToken()) return;
    lastOrgId.current = orgId;
    if (orgSlug) {
      setOrganizationSlug(orgSlug);
      persistCartOrg(orgId, orgSlug);
    }
    setIsLoading(true);
    try {
      const data = await getCart(orgId);
      setCart(data);
    } catch {
      // 401 handled globally; swallow everything else
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On mount: restore cart from the last known org (survives page refresh)
  useEffect(() => {
    const org = getPersistedCartOrg();
    if (org && getToken()) {
      refreshCart(org.id, org.slug);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addWorkshop = useCallback(
    async (orgId: number, workshopId: number, orgSlug?: string): Promise<Cart> => {
      const updated = await addCartItem(orgId, {
        item_type: 'workshop_registration',
        workshop_id: workshopId,
      });
      setCart(updated);
      lastOrgId.current = orgId;
      if (orgSlug) {
        setOrganizationSlug(orgSlug);
        persistCartOrg(orgId, orgSlug);
      }
      return updated;
    },
    [],
  );

  const removeItem = useCallback(async (orgId: number, itemId: number): Promise<void> => {
    const updated = await removeCartItem(orgId, itemId);
    setCart(updated);
  }, []);

  const updateCart = useCallback((updated: Cart) => {
    setCart(updated);
  }, []);

  const clearCart = useCallback(() => {
    setCart(null);
    setOrganizationSlug(null);
    lastOrgId.current = null;
    clearPersistedCartOrg();
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((v) => !v), []);

  const itemCount = cart?.items?.length ?? 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        isOpen,
        organizationSlug,
        openCart,
        closeCart,
        toggleCart,
        refreshCart,
        addWorkshop,
        removeItem,
        updateCart,
        clearCart,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext);
}
