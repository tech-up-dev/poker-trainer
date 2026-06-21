# React App - Feature Implementation Guide

> **Purpose**: Master prompt for AI agents implementing features in React projects.
> This is the React counterpart to `ANGULAR_FEATURE_IMPLEMENTATION_GUIDE.md` — same
> principles (strict typing, service-layer separation, consistent UI conventions),
> translated to React-idiomatic tooling. Every rule here reflects agreed codebase
> conventions — follow them exactly.

---

## Table of Contents

1. [Project Setup & Tooling](#1-project-setup--tooling)
2. [Folder Architecture & File Organization](#2-folder-architecture--file-organization)
3. [Component Conventions & App Bootstrap](#3-component-conventions--app-bootstrap)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [State Management: Local, Global & Server State](#5-state-management-local-global--server-state)
6. [API Requests & HTTP Layer](#6-api-requests--http-layer)
7. [Routing Strategy](#7-routing-strategy)
8. [Forms: React Hook Form & Zod](#8-forms-react-hook-form--zod)
9. [Component Design Principles](#9-component-design-principles)
10. [Styling: Tailwind CSS & UI Standards](#10-styling-tailwind-css--ui-standards)
11. [Error Handling & Logging](#11-error-handling--logging)
12. [Performance Optimization](#12-performance-optimization)
13. [Testing Standards](#13-testing-standards)
14. [Code Style & Naming Conventions](#14-code-style--naming-conventions)
15. [Security Standards](#15-security-standards)
16. [Environment & Configuration Management](#16-environment--configuration-management)
17. [Quick Reference: Decision Matrix](#17-quick-reference-decision-matrix)

---

## 1. Project Setup & Tooling

### React Version & Scaffolding

Always use the **latest stable React release** with **Vite** as the build tool (faster than CRA, which is no longer maintained).

```bash
# Create new project
npm create vite@latest project-name -- --template react-ts

cd project-name
npm install
```

| Choice | Value | Reason |
|--------|-------|--------|
| Build tool | **Vite** | Fast dev server, instant HMR, simple config. CRA is deprecated. |
| Language | **TypeScript** | Same strict-typing rationale as Angular. |
| Package manager | `npm` or `pnpm` | Pick one per project and stay consistent. |

### TypeScript Strict Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "jsx": "react-jsx"
  }
}
```

> **Never use `any` as a type.** Use `unknown` and narrow with type guards when the shape is truly unknown.

### Core Library Stack — Install Up Front

These libraries form the backbone of every project and replace specific Angular building blocks:

```bash
npm install react-router-dom @tanstack/react-query zustand axios react-hook-form zod @hookform/resolvers
npm install -D tailwindcss postcss autoprefixer
```

| Library | Replaces (Angular equivalent) | Purpose |
|---------|-------------------------------|---------|
| `react-router-dom` | `@angular/router` | Routing, lazy loading, guards |
| `@tanstack/react-query` | `resource()` / `HttpClient` + caching | Server state, fetching, caching, retries |
| `zustand` | Signal-based services (`CartService`, `AuthService`) | Global client state |
| `axios` | `HttpClient` | HTTP requests, interceptors |
| `react-hook-form` + `zod` | Typed Reactive Forms | Forms + validation |
| `tailwindcss` | Tailwind CSS | Styling (identical setup to Angular) |

### Node & Package Manager

- Use the Node.js LTS version.
- Commit `package-lock.json` or `pnpm-lock.yaml`. Never commit `node_modules`.

---

## 2. Folder Architecture & File Organization

### Standard Folder Structure

The same `core / features / shared / layout` mental model as Angular, adapted to React file types.

```
src/
  core/                          # App-wide singletons: auth, api client, error boundary
    auth/
      auth.store.ts              # Zustand store (replaces AuthService)
      auth.types.ts              # Interfaces — mirrors backend records
      authApi.ts                 # Login/me/password endpoints
      ProtectedRoute.tsx          # Route guard wrapper (replaces authGuard)
      RequireType.tsx             # Role-based guard wrapper
      useAuthInit.ts              # Session restoration on app load
    api/
      axiosInstance.ts            # Axios instance + interceptors (token, errors)
    types/                       # Global interfaces & types
      pagination.types.ts
      search.types.ts
    utils/                       # Pure helper functions, validators
    ErrorBoundary.tsx            # Global error boundary
  features/                      # Feature-based grouped components
    dashboard/
      Dashboard.tsx
      dashboard.routes.tsx
      hooks/                     # Feature-scoped hooks (useDashboardData, etc.)
      components/                # Sub-components used only in this feature
      api/                       # Feature-scoped API modules
    users/
    products/
  shared/                         # Reusable UI: components, hooks
    components/
      Button/
        Button.tsx
      Badge/
        Badge.tsx
      Pagination/
        Pagination.tsx
    hooks/                       # Reusable hooks with zero business logic
  layout/                         # Shell, sidebar, navbar, footer
    Shell.tsx
    Navbar.tsx
  App.tsx                         # Root component, router outlet
  main.tsx                        # Entry point, providers
  index.css                       # Tailwind directives + global base layer
```

### Folder Rules

| Folder | Rule |
|--------|------|
| `core/` | Imported once at root. Only singletons: auth, API client, error boundary, global types. |
| `features/` | One folder per route or business domain. Each feature is self-contained. |
| `shared/` | Components and hooks with zero business logic. Purely presentational/reusable. |
| `layout/` | Structural wrapper components only. Never inside `features/`. |

> **Never put business logic inside `shared/`.** If a component needs feature-specific data fetching, it belongs in a feature folder.

### File Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Component | `PascalCase.tsx` | `UserProfile.tsx` |
| Hook | `useCamelCase.ts` | `useAuth.ts`, `useDebounce.ts` |
| Zustand store | `camelCase.store.ts`, hook named `useXStore` | `cart.store.ts` → `useCartStore` |
| API module | `camelCase.api.ts` | `user.api.ts` |
| Types/interfaces | `camelCase.types.ts` | `user.types.ts` |
| Route config | `feature.routes.tsx` | `dashboard.routes.tsx` |
| Test file | `Component.test.tsx` (co-located) | `UserCard.test.tsx` |
| Pure utility | `camelCase.ts` | `validators.ts` |

### Component File Rule — Different From Angular On Purpose

Angular mandates separate `.ts` / `.html` / `.scss` files per component. **React does not** —
JSX combines markup and logic by design, and Tailwind utility classes live inline in the JSX.

```
UserCard.tsx        ← component logic + JSX markup + Tailwind classes, all in one file
UserCard.test.tsx   ← co-located test file (recommended, not mandatory)
```

```tsx
// ✅ CORRECT — single file, JSX markup + Tailwind classes inline
export function UserCard({ user }: { user: User }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <p className="text-sm font-semibold text-gray-900">{user.name}</p>
    </div>
  );
}
```

Only create a separate `.css`/`.module.css` file for:
- Global resets / base styles (`index.css`)
- Complex keyframe animations not expressible with Tailwind utilities

---

## 3. Component Conventions & App Bootstrap

### Functional Components Only

**Always write function components with hooks.** Never write class components, with **one
unavoidable exception**: React's error boundary API still requires a class component (see
[Section 11](#11-error-handling--logging)) — this is a React platform limitation, not a style choice.

### App Bootstrap — `main.tsx`

```tsx
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './app.routes';
import { GlobalErrorBoundary } from './core/ErrorBoundary';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
```

### Lazy Loading — Mandatory

Every feature route must be lazy-loaded with `React.lazy()` (or the router's built-in
`lazy` route property). Never eagerly import feature components at the root.

```tsx
// app.routes.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Shell } from './layout/Shell';
import { ProtectedRoute } from './core/auth/ProtectedRoute';
import { userRoutes } from './features/users/users.routes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      {
        path: 'dashboard',
        lazy: () => import('./features/dashboard/Dashboard').then(m => ({ Component: m.Dashboard })),
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'users', children: userRoutes },
        ],
      },
      {
        path: '*',
        lazy: () => import('./features/not-found/NotFound').then(m => ({ Component: m.NotFound })),
      },
    ],
  },
]);
```

---

## 4. Authentication & Authorization

### Authentication Flow — Identical To Angular

Same two-step JWT flow agreed with the backend team. Login returns tokens in the response body;
user data is fetched in a separate subsequent call.

| Step | Action | Endpoint |
|------|--------|----------|
| 1 | Submit credentials → receive `AccessToken` + `RefreshToken` | `POST /api/v1/Authenticate/login` |
| 2 | Fetch full user profile using the access token | `GET /api/v1/User/me` |
| 3 | Attach Bearer token to all subsequent requests | Axios request interceptor (automatic) |

### Token Storage — Identical Rule

| Token | Storage | Reason |
|-------|---------|--------|
| Access token | **Memory only** — held in the Zustand auth store | Lost on page refresh by design; short-lived |
| Refresh token | **`localStorage`** | Needed to silently re-authenticate after page refresh |

> **Never store the access token in `localStorage` or `sessionStorage`.** In-memory tokens
> expire quickly and limit XSS blast radius.

### API Endpoints Reference — Identical

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/Authenticate/login` | Login — returns `AccessToken` + `RefreshToken` |
| `GET`  | `/api/v1/User/me` | Get current user profile (requires Bearer token) |
| `PUT`  | `/api/v1/User/change-password` | Change password for authenticated user |
| `POST` | `/api/v1/User/forgot-password` | Request password reset email |
| `POST` | `/api/v1/User/reset-password` | Submit new password with `uid` + `token` from email |

### TypeScript Interfaces — `core/auth/auth.types.ts`

Identical to the Angular interfaces — mirrors backend `.NET` records in camelCase.

```typescript
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MeResponse {
  id: number;
  firstName: string;
  lastName: string;
  picture: string | null;
  email: string;
  phoneNumber: string | null;
  suspensionReason: string | null;
  dateCreated: string;            // ISO 8601 — format with date-fns
  status: ListItemBaseResponse;
  type: string;
  profilePicture: string | null;
}

export interface ListItemBaseResponse {
  id: number;
  name: string;
}

export interface ChangePasswordRequest { oldPassword: string; newPassword: string; }
export interface ForgotPasswordRequest { email: string; }
export interface ResetPasswordRequest  { uid: string; token: string; password: string; }
```

### Auth Store — `core/auth/auth.store.ts` (Zustand)

This is the React equivalent of Angular's signal-based `AuthService`. Expose state and
actions together; only the store mutates its own state.

```typescript
import { create } from 'zustand';
import { authApi } from './authApi';
import type { LoginRequest, MeResponse } from './auth.types';

interface AuthState {
  accessToken: string | null;       // memory only — never persisted
  currentUser: MeResponse | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<void>;
  loadCurrentUser: () => Promise<void>;
  logout: () => void;
  setAccessToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  currentUser: null,
  isAuthenticated: false,

  // Step 1: POST /api/v1/Authenticate/login → Step 2: GET /api/v1/User/me
  login: async (request) => {
    const res = await authApi.login(request);
    set({ accessToken: res.accessToken });
    localStorage.setItem('refreshToken', res.refreshToken);
    await get().loadCurrentUser();
  },

  // GET /api/v1/User/me — interceptor attaches Bearer token automatically
  loadCurrentUser: async () => {
    const user = await authApi.me();
    set({ currentUser: user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('refreshToken');
    set({ accessToken: null, currentUser: null, isAuthenticated: false });
  },

  setAccessToken: (token) => set({ accessToken: token }),
}));
```

### Axios Instance & Token Interceptor — `core/api/axiosInstance.ts`

```typescript
import axios from 'axios';
import { useAuthStore } from '../auth/auth.store';

const PUBLIC_ENDPOINTS = [
  '/api/v1/Authenticate/login',
  '/api/v1/User/forgot-password',
  '/api/v1/User/reset-password',
];

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Attach Bearer token to every request except public endpoints
api.interceptors.request.use((config) => {
  const isPublic = PUBLIC_ENDPOINTS.some(url => config.url?.includes(url));
  if (isPublic) return config;

  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Centralized error handling — replaces Angular's errorInterceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    switch (error.response?.status) {
      case 0:
        showToast('No network connection.');
        break;
      case 500:
        showToast('Server error. Please try again later.');
        break;
    }
    return Promise.reject(error);
  }
);
```

### Session Restoration on Page Refresh — `core/auth/useAuthInit.ts`

```typescript
// Runs once on app mount — silently restores session from refreshToken in localStorage
export function useAuthInit() {
  const [isReady, setIsReady] = useState(false);
  const { loadCurrentUser, logout } = useAuthStore();

  useEffect(() => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      setIsReady(true);
      return;
    }
    authApi.refreshAccessToken(refreshToken)
      .then(({ accessToken }) => {
        useAuthStore.getState().setAccessToken(accessToken);
        return loadCurrentUser();
      })
      .catch(() => logout())
      .finally(() => setIsReady(true));
  }, []);

  return isReady;
}
```

Call this hook once near the root (e.g., in `Shell.tsx`) and render a full-page loader until
`isReady` is `true`.

### Route Guards — `core/auth/ProtectedRoute.tsx`

React Router has no guard API like `CanActivateFn` — guards are **wrapper components**
rendering `<Outlet />` or redirecting via `<Navigate />`.

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './auth.store';

// Basic authentication guard
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Suspended user guard — checks MeResponse.suspensionReason
export function ActiveUserRoute() {
  const suspensionReason = useAuthStore(s => s.currentUser?.suspensionReason);
  return suspensionReason ? <Navigate to="/suspended" replace /> : <Outlet />;
}

// Type-based guard — checks MeResponse.type
export function RequireType({ type }: { type: string }) {
  const userType = useAuthStore(s => s.currentUser?.type);
  return userType?.toLowerCase() === type.toLowerCase()
    ? <Outlet />
    : <Navigate to="/forbidden" replace />;
}
```

```tsx
// Usage in app.routes.tsx
{
  element: <ProtectedRoute />,
  children: [
    { element: <RequireType type="Admin" />, children: [ /* admin-only routes */ ] },
    /* regular authenticated routes */
  ],
}
```

### Authorization Notes — Identical

- `user.type` — use for role/type-based feature gating (e.g., `'Admin'`, `'Manager'`, `'User'`).
- `user.status` — use to determine account state; `suspensionReason` drives suspension flows.
- `user.profilePicture` — prefer over `user.picture`; fall back to `picture` if null.
- All `type` and `status` string comparisons must be **case-insensitive**.

---

## 5. State Management: Local, Global & Server State

### Decision Rule

| Scenario | Use |
|----------|-----|
| Local component state (toggle, counter, form values) | `useState` / `useReducer` |
| Cross-component / global UI state (user, cart, theme) | **Zustand** store |
| HTTP requests / server data | **TanStack Query** (`useQuery` / `useMutation`) |
| Event streams (debounced search, websockets) | `useEffect` + custom hook |
| Derived/computed values from state | `useMemo` |
| Side-effects when state changes | `useEffect` |
| Routing events | `useLocation` / `useNavigate` / `useSearchParams` |

> **Default**: Zustand for shared client state, TanStack Query for anything that comes from
> the server. This mirrors Angular's "Signals for state, Observables for async" split —
> TanStack Query is the React analog of `resource()` combined with HTTP caching.

### Local State — Component-Level

```tsx
export function ProductList({ products }: { products: Product[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // useMemo = Angular's computed() — memoized, recalculates only on dependency change
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products
      .filter(p => p.name.toLowerCase().includes(term))
      .filter(p => !selectedCategory || p.category === selectedCategory);
  }, [products, searchTerm, selectedCategory]);

  useEffect(() => {
    // Runs whenever searchTerm changes — use for URL sync, analytics, etc.
    console.log('Search changed:', searchTerm);
  }, [searchTerm]);

  return ( /* ... */ );
}
```

### Zustand — Global Client State

Direct equivalent of Angular's signal-based services. Expose state and actions from one
store; components subscribe only to the slices they need.

```typescript
// shared/store/cart.store.ts
import { create } from 'zustand';
import type { Product, CartItem } from '../types/cart.types';

interface CartState {
  items: CartItem[];
  totalCount: () => number;
  totalPrice: () => number;
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  totalCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
  totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),

  addItem: (product) => set((state) => {
    const existing = state.items.find(i => i.id === product.id);
    if (existing) {
      return { items: state.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) };
    }
    return { items: [...state.items, { ...product, qty: 1 }] };
  }),

  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
}));
```

```tsx
// Component usage — subscribe only to what you need (avoids unnecessary re-renders)
const items = useCartStore(s => s.items);
const addItem = useCartStore(s => s.addItem);
```

### TanStack Query — Server State

Never use `useEffect` + `useState` to fetch data manually. **TanStack Query handles
caching, loading/error states, retries, and refetching** — it is the React analog of
Angular's `resource()`.

```tsx
// Bridge a feature API module → component
const { data: users, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['users'],
  queryFn: userApi.getAll,
});

// Mutation — create/update/delete
const queryClient = useQueryClient();
const createUser = useMutation({
  mutationFn: userApi.create,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
});
```

### Async Operator Selection — TanStack Query Equivalents

| Angular RxJS Pattern | TanStack Query Equivalent |
|-----------------------|----------------------------|
| `switchMap` (search/autocomplete, cancels in-flight) | Built-in — query auto-cancels on `queryKey` change |
| `mergeMap` (parallel requests) | Multiple independent `useQuery` calls |
| `concatMap` (sequential requests) | Chain via `enabled` option / `await` in `queryFn` |
| `exhaustMap` (ignore clicks while in-flight) | Check `mutation.isPending` and disable the button |

### Debounced Search — Custom Hook

```typescript
// shared/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

### No Heavier State Libraries By Default

**Do not add Redux or MobX** to new projects. Zustand + TanStack Query cover all state
management needs with far less boilerplate. If a project genuinely outgrows Zustand,
**Redux Toolkit** is the first escalation step — not classic Redux.

---

## 6. API Requests & HTTP Layer

### Rule: API Calls Always Go in API Modules + Query Hooks

**Components must never call `axios` directly.** All HTTP calls are encapsulated in
dedicated API modules and consumed via TanStack Query. This is a hard rule with no exceptions.

> **Never call `api.get(...)` inside a component body.** Components that call Axios
> directly are untestable and violate separation of concerns.

### API Module Structure

```typescript
// features/users/api/user.api.ts
import { api } from '../../../core/api/axiosInstance';
import type { User, CreateUserDto, UpdateUserDto } from '../user.types';
import type { PagedResponse } from '../../../core/types/pagination.types';

const BASE_URL = '/users';

export const userApi = {
  getAll: (): Promise<PagedResponse<User>> =>
    api.get(BASE_URL).then(res => res.data),

  getById: (id: number): Promise<User> =>
    api.get(`${BASE_URL}/${id}`).then(res => res.data),

  create: (dto: CreateUserDto): Promise<User> =>
    api.post(BASE_URL, dto).then(res => res.data),

  update: (id: number, dto: UpdateUserDto): Promise<User> =>
    api.put(`${BASE_URL}/${id}`, dto).then(res => res.data),

  delete: (id: number): Promise<void> =>
    api.delete(`${BASE_URL}/${id}`).then(res => res.data),
};
```

### Typing Rules — Identical

- Every API call must be generically typed via the function's return type: `Promise<User[]>`, `Promise<AuthResponse>`.
- **Never use `Promise<any>`** or omit the return type.
- Define request/response interfaces in the feature's `*.types.ts`, or `core/types/` if shared across features.

### Shared Pagination Models — `core/types/pagination.types.ts`

Identical shapes to Angular:

```typescript
export interface PagedRequest {
  page: number;       // 1-based
  pageSize: number;   // default: 10
}

export interface PagedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### Error Handling

```typescript
// core/utils/apiError.ts
import { AxiosError } from 'axios';

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message ?? error.message ?? 'Unknown error';
  }
  return 'Unknown error';
}
```

The response interceptor in `axiosInstance.ts` (see [Section 4](#4-authentication--authorization))
handles global error codes centrally — individual API modules do not repeat that logic.

### Search & Filter Tables — Standard Request Shape (Identical)

Whenever a feature includes a table with search/filter functionality, the API request
**must** follow this exact shape — same as Angular, no per-feature reinvention.

```typescript
// core/types/search.types.ts

export interface PagingRequest {
  pageNumber: number;   // 1-based
  pageSize: number;     // default: 10
}

export interface SortingRequest {
  field: number;        // enum value — defined per feature (e.g. UserSortField)
  sortOrder: number;    // 1 = ascending, 2 = descending
}

// Base — extend this per feature, adding feature-specific filter fields
export interface BaseSearchRequest {
  query: string | null;
  paging: PagingRequest;
  sorting: SortingRequest;
}

// Feature-specific example — add only the filter fields that apply
export interface UserSearchRequest extends BaseSearchRequest {
  status: number | null;   // null = all, otherwise filter by status enum value
}
```

**JSON shape sent to the API:**

```json
{
  "query": "john",
  "status": 1,
  "paging": { "pageNumber": 1, "pageSize": 10 },
  "sorting": { "field": 1, "sortOrder": 1 }
}
```

**API module method — always `POST` for search endpoints:**

```typescript
// features/users/api/user.api.ts
search: (request: UserSearchRequest): Promise<PagedResponse<User>> =>
  api.post(`${BASE_URL}/search`, request).then(res => res.data),
```

**Component — managing search state with `useState` + TanStack Query:**

```tsx
export function UserList() {
  // Filter state — each field is separate state for granular updates
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(10);
  const [sortField, setSortField] = useState(1);
  const [sortOrder, setSortOrder] = useState(1);

  const debouncedQuery = useDebounce(query, 300);

  // Rebuild the request object whenever any filter changes
  const searchRequest: UserSearchRequest = {
    query: debouncedQuery || null,
    status: statusFilter,
    paging: { pageNumber, pageSize },
    sorting: { field: sortField, sortOrder },
  };

  // Re-fires automatically when searchRequest changes (queryKey includes it)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', 'search', searchRequest],
    queryFn: () => userApi.search(searchRequest),
  });

  function onSearch(value: string) {
    setQuery(value);
    setPageNumber(1);   // Reset to page 1 on new search
  }

  function onFilterChange(status: number | null) {
    setStatusFilter(status);
    setPageNumber(1);
  }

  function onSortChange(field: number, order: number) {
    setSortField(field);
    setSortOrder(order);
    setPageNumber(1);
  }

  return ( /* ... */ );
}
```

> **Always reset `pageNumber` to `1`** when the query, filters, or sorting change. Never
> carry the current page across a new search — the result count will differ.

---

## 7. Routing Strategy

### Router Configuration

```bash
npm install react-router-dom
```

Use `createBrowserRouter` with nested routes and lazy-loaded leaf routes (see
[Section 3](#3-component-conventions--app-bootstrap) for the full example).

### Route Parameters

```tsx
// features/users/UserDetail.tsx
export function UserDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['users', id],
    queryFn: () => userApi.getById(Number(id)),
    enabled: !!id,
  });

  return ( /* ... */ );
}
```

### URL Query Params for Pagination

Use `useSearchParams` to keep pagination/filter state shareable and bookmarkable — same
requirement as Angular's URL sync rule.

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get('page') ?? '1');
const pageSize = Number(searchParams.get('pageSize') ?? '10');

function onPageChange(newPage: number) {
  setSearchParams(prev => {
    prev.set('page', String(newPage));
    return prev;
  });
}
```

### Feature Routes

```tsx
// features/users/users.routes.tsx
import type { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '../../core/auth/ProtectedRoute';

export const userRoutes: RouteObject[] = [
  { index: true, lazy: () => import('./UserList').then(m => ({ Component: m.UserList })) },
  { path: ':id', lazy: () => import('./UserDetail').then(m => ({ Component: m.UserDetail })) },
  {
    path: ':id/edit',
    element: <ProtectedRoute />,
    children: [
      { index: true, lazy: () => import('./UserEdit').then(m => ({ Component: m.UserEdit })) },
    ],
  },
];
```

### Route Organization Rules — Identical

- Each feature has its own `feature.routes.tsx` file.
- `app.routes.tsx` only contains top-level lazy-loaded entries — all route details live in feature files.
- All paths: lowercase, hyphen-separated, no trailing slashes.
- Always define a `*` wildcard route pointing to a `NotFound` component.

---

## 8. Forms: React Hook Form & Zod

### Default: React Hook Form + Zod Always

All forms use **React Hook Form** with **Zod** schema validation. Plain `useState`-controlled
inputs are only acceptable for trivial single-field inputs with no validation (e.g., a
standalone search box).

```bash
npm install react-hook-form zod @hookform/resolvers
```

### Typed Forms — Mandatory

Zod schemas are the equivalent of Angular's typed `FormGroup`. Always derive the form type
from the schema with `z.infer`.

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean(),
});

export type LoginForm = z.infer<typeof loginSchema>;
```

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginForm } from './login.schema';

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (data: LoginForm) => {
    // data.email and data.password are typed `string` — no casting needed
    await useAuthStore.getState().login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          {...register('email')}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>
      {/* password, rememberMe fields ... */}
      <Button type="submit" variant="save" loading={isSubmitting}>Log in</Button>
    </form>
  );
}
```

### Custom Validators — Pure Zod Refinements

Write custom validation as Zod `.refine()` / `.superRefine()` calls, not classes. Place
shared validators in `core/utils/validators.ts` or `feature/utils/validators.ts` if
feature-specific.

```typescript
// core/utils/validators.ts
export const passwordStrengthSchema = z.string().refine((value) => {
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[!@#$%^&*]/.test(value);
  return hasUpper && hasNumber && hasSpecial;
}, { message: 'Password must contain an uppercase letter, a number, and a special character' });
```

### Validation Error Display

- Create a shared `FieldError` component that accepts an `error?: FieldError` (from React
  Hook Form) and renders the message consistently.
- **Never** scatter raw `{errors.x && <p>...</p>}` blocks with inconsistent styling across forms.
- Use a centralized error message map in Zod schemas (the `message` argument) to ensure
  consistency across the entire app.

```tsx
// shared/components/FieldError.tsx
import type { FieldError as RHFFieldError } from 'react-hook-form';

export function FieldError({ error }: { error?: RHFFieldError }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-red-600">{error.message}</p>;
}
```

---

## 9. Component Design Principles

### Smart vs Dumb Components — Identical Split

| Type | Responsibility |
|------|---------------|
| **Smart (Page/Container)** | Uses hooks (`useQuery`, `useAuthStore`), manages state, performs data fetching. One per route. |
| **Dumb (Presentational)** | Receives data via props, emits events via callback props. No store/query hooks. Fully reusable. |

> **Never mix these responsibilities** in the same component.

```tsx
// ✅ Dumb component — props only
interface UserCardProps {
  user: User;
  showActions?: boolean;
  onDelete: (id: number) => void;
}

export function UserCard({ user, showActions = true, onDelete }: UserCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
      {showActions && (
        <Button variant="delete" size="sm" onClick={() => onDelete(user.id)}>Delete</Button>
      )}
    </div>
  );
}
```

### Memoization — `OnPush` Equivalent

React re-renders by default on every parent render. Use these tools deliberately —
**not everywhere**, but on components that render frequently or receive stable props:

| Angular | React Equivalent |
|---------|-------------------|
| `ChangeDetectionStrategy.OnPush` | `React.memo(Component)` |
| `computed()` | `useMemo(() => ..., [deps])` |
| Stable callback references passed to child | `useCallback(() => ..., [deps])` |

```tsx
export const UserCard = React.memo(function UserCard({ user, onDelete }: UserCardProps) {
  return ( /* ... */ );
});
```

> Use template getters → **never**. Use `useMemo` instead — getters/inline calculations
> re-run on every render; `useMemo` is memoized.

### Conditional Rendering & Lists

```tsx
// Conditional — equivalent of @if / @else
{user ? <UserCard user={user} /> : <p className="text-gray-500">No user found.</p>}

// List — equivalent of @for ... @empty
{items.length === 0 ? (
  <p className="text-gray-400">No items yet.</p>
) : (
  items.map(item => <ItemRow key={item.id} item={item} />)
)}
```

> **Always use a stable `key` (e.g., `item.id`).** Never use the array index as `key` for
> lists that can be reordered, filtered, or have items added/removed — this is the direct
> equivalent of Angular's "never `track $index`" rule.

### Hook Order Convention

Maintain this order consistently inside every component:

1. Router/store hooks (`useParams`, `useNavigate`, `useAuthStore`, etc.)
2. Local state (`useState`, `useReducer`)
3. Server state (`useQuery`, `useMutation`)
4. Derived/computed values (`useMemo`)
5. Effects (`useEffect`)
6. Event handlers
7. Render (JSX return)

### Component Size Rules — Identical

- Component exceeds **150 lines** → split into sub-components or extract logic into a custom hook.
- One component = one primary concern (Single Responsibility Principle).
- Extract repeated JSX blocks into sub-components, not loops over JSX fragments.

---

## 10. Styling: Tailwind CSS & UI Standards

### Tailwind Setup — Identical To Angular

Tailwind CSS is the **mandatory styling framework** for all projects. Plain CSS is reserved
for global resets and complex animations only.

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```javascript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#your-brand-color' },
        secondary: { DEFAULT: '#your-accent-color' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
};
```

```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { @apply box-border; }
  body { @apply bg-gray-50 text-gray-900 font-sans antialiased; }
}
```

> **Never write plain CSS when a Tailwind utility exists. No arbitrary values like `p-[13px]`** — use the spacing scale.

### Button Color Conventions — Identical

Every project uses the same semantic button color system. Apply these automatically —
they do not need to be specified per feature.

| Intent | Tailwind Classes | Examples |
|--------|-----------------|---------|
| Save / Create / Confirm | `bg-green-600 hover:bg-green-700 text-white` | Save, Create, Add, Submit |
| Update / Edit / Modify | `bg-amber-500 hover:bg-amber-600 text-white` | Update, Edit, Modify, Rename |
| Delete / Remove | `bg-red-600 hover:bg-red-700 text-white` | Delete, Remove, Discard |
| Navigate / View / Open | `bg-blue-600 hover:bg-blue-700 text-white` | View, Open, Details, Preview |
| Cancel / Back | `bg-gray-100 hover:bg-gray-200 text-gray-700` | Cancel, Close, Back |
| Neutral / Secondary | `border border-gray-300 hover:bg-gray-50 text-gray-700` | Export, Download, Copy |
| Danger confirmation | `bg-red-700 hover:bg-red-800 text-white ring-2 ring-red-300` | Confirm Delete (inside modal) |

All buttons must include: `transition-colors`, `font-medium`, consistent padding
(`px-4 py-2` standard / `px-3 py-1.5` compact), `rounded`, and disabled state
`opacity-50 cursor-not-allowed`.

### Button Component — `shared/components/Button/Button.tsx`

Create and use this component everywhere. Never inline raw `<button>` HTML for action buttons.

```tsx
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'save' | 'update' | 'delete' | 'navigate' | 'cancel' | 'neutral';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  save: 'bg-green-600 hover:bg-green-700 text-white',
  update: 'bg-amber-500 hover:bg-amber-600 text-white',
  delete: 'bg-red-600 hover:bg-red-700 text-white',
  navigate: 'bg-blue-600 hover:bg-blue-700 text-white',
  cancel: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  neutral: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'neutral',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    'rounded font-medium transition-colors inline-flex items-center gap-2',
    (disabled || loading) ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && (
        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
      )}
      {children}
    </button>
  );
}

// Usage examples:
// <Button variant="save" onClick={save}>Save</Button>
// <Button variant="delete" loading={isDeleting}>Delete</Button>
// <Button variant="cancel" onClick={cancel}>Cancel</Button>
```

### Data Tables — Pagination Mandatory

**Every data table includes pagination by default.** A table without pagination is never
acceptable. Pagination state must be reflected in the URL query params (`useSearchParams`)
so users can share and bookmark pages.

- Default page size: **10 rows**
- Available options: **10 / 25 / 50**
- URL sync: `?page=1&pageSize=10`

```tsx
// Standard table structure
<div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
        <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {pagedItems.map(item => (
        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
          <td className="px-4 py-3 text-gray-900">{item.name}</td>
          <td className="px-4 py-3"><Badge variant={item.statusVariant}>{item.status}</Badge></td>
          <td className="px-4 py-3 flex justify-end gap-2">
            <Button variant="navigate" size="sm">View</Button>
            <Button variant="update" size="sm">Edit</Button>
            <Button variant="delete" size="sm">Delete</Button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Always present — never omit */}
  <Pagination
    totalCount={totalCount}
    page={page}
    pageSize={pageSize}
    onPageChange={onPageChange}
    onPageSizeChange={onPageSizeChange}
  />
</div>
```

### General UI Standards — Identical

These apply to every component in every project without needing to be specified per feature.

**Layout**
- Page content wrapper: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Cards / panels: `bg-white rounded-lg border border-gray-200 shadow-sm p-6`
- Vertical rhythm between sections: `space-y-6` or `space-y-8`

**Typography**
- Page title: `text-2xl font-bold text-gray-900`
- Section heading: `text-lg font-semibold text-gray-900`
- Body text: `text-sm text-gray-700`
- Secondary / metadata: `text-sm text-gray-500`
- Error text: `text-sm text-red-600`
- Never use `text-black` — `text-gray-900` is the darkest value

**Interactive States**
- Every clickable element must have a `hover:` state
- Focus ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`
- Transitions: `transition-colors duration-150` on all interactive elements
- Disabled: `opacity-50 cursor-not-allowed`

**Form Inputs**
```
Standard: w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
Error:    border-red-500 focus:ring-red-500
Label:    block text-sm font-medium text-gray-700 mb-1
Helper:   mt-1 text-xs text-gray-500
Error msg: mt-1 text-xs text-red-600
```

**Status Badges — `shared/components/Badge/Badge.tsx`**

| Variant | Classes | Common Uses |
|---------|---------|-------------|
| `success` | `bg-green-100 text-green-800` | Active, Approved, Completed |
| `warning` | `bg-amber-100 text-amber-800` | Pending, In Review |
| `danger` | `bg-red-100 text-red-800` | Suspended, Rejected |
| `info` | `bg-blue-100 text-blue-800` | Draft, Scheduled |
| `neutral` | `bg-gray-100 text-gray-700` | Inactive, Archived |

**Loading / Empty / Error States**
- Loading: **skeleton loader** (animated gray blocks) — never a raw `"Loading..."` string or bare spinner
- Empty: icon + heading ("No items found") + subtitle + optional CTA button
- Error: red-bordered card + error icon + message + "Try again" button

**Modals & Destructive Actions**
- All destructive actions (delete, deactivate, suspend) require a **confirmation modal** before executing.
- Confirm button inside a delete modal always uses `variant="delete"` with an explicit label: `"Yes, delete [item name]"`.
- Overlay: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50`
- Panel: `bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4`

**Responsive Design**
- All UIs are **mobile-first**. Every layout must be usable at 375px and scale to 1440px+.
- Navigation collapses to hamburger menu on mobile.
- Tables switch to card-based list layout on small screens.
- Long forms: full-width on mobile, 2-column grid on `md:` and above.
- Never use fixed pixel widths on containers — always `max-w-*` with `w-full`.

---

## 11. Error Handling & Logging

### Global Error Boundary — `core/ErrorBoundary.tsx`

This is the **one place a class component is required** — React's error boundary API has
no hook equivalent.

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[Global Error]', error, info);
    // Forward to monitoring service (Sentry, Datadog, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto mt-20 bg-white border border-red-200 rounded-lg p-6 text-center">
          <p className="text-sm text-red-600">Something went wrong. Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

HTTP-status-driven redirects (403 → `/forbidden`, 404 → `/not-found`) are handled in the
**Axios response interceptor** (see [Section 4](#4-authentication--authorization)), not the
error boundary — the boundary only catches render errors.

### Component-Level Error States

Every component that fetches data must explicitly handle all three async states:

| State | UI Requirement |
|-------|---------------|
| Loading | Skeleton loader — never a raw spinner with text |
| Error | Red-bordered card, user-friendly message, "Try again" button |
| Empty | Icon + heading + subtitle + optional CTA |

### TanStack Query Pattern (Preferred)

```tsx
const { data: user, isLoading, isError, refetch } = useQuery({
  queryKey: ['users', id],
  queryFn: () => userApi.getById(id),
});

if (isLoading) return <Skeleton />;
if (isError) return <ErrorCard onRetry={refetch} />;
if (!user) return <EmptyState />;
return <UserCard user={user} />;
```

---

## 12. Performance Optimization

### Re-render Control

- `React.memo` on presentational components that render often — covered in [Section 9](#9-component-design-principles).
- Use `useMemo` instead of recalculating derived values inline in JSX — same rationale as Angular's `computed()` vs. template getters.
- Use `useCallback` for functions passed as props to memoized children.

### Image Optimization

```tsx
<img src="/assets/hero.jpg" width={800} height={400} loading="eager" />
<img src="/assets/product.jpg" width={300} height={300} loading="lazy" />
```

Always set explicit `width`/`height` to prevent layout shift. For responsive images, use
`srcSet` + `sizes`. Consider `vite-imagetools` for build-time image optimization.

### Virtual Scrolling

Lists with **50+ items** must use a virtualization library (`@tanstack/react-virtual` or
`react-window`). Never render unbounded lists.

```bash
npm install @tanstack/react-virtual
```

### List Keys

Always use a stable, unique `key` (e.g., `item.id`). Never use the array index as `key`
for lists that can be reordered — see [Section 9](#9-component-design-principles).

```tsx
// ✅ Correct
{users.map(user => <UserRow key={user.id} user={user} />)}

// ❌ Wrong
{users.map((user, index) => <UserRow key={index} user={user} />)}
```

### Bundle Size

- Analyze: `npm run build -- --mode production` with `rollup-plugin-visualizer`
- Initial bundle target: **under 200KB gzipped**
- Heavy third-party libraries (charts, PDF viewers) loaded lazily at the component level via `React.lazy()`, never imported at root
- Vite tree-shakes automatically — avoid default-exporting large barrel files

---

## 13. Testing Standards

### Testing Stack

| Test Type | Tool |
|-----------|------|
| Unit tests | **Vitest** (Vite-native, Jest-compatible API) |
| Component tests | **React Testing Library** + Vitest |
| E2E tests | **Playwright** |
| HTTP mocking | **MSW** (Mock Service Worker) |

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom msw
```

### Unit Testing API Modules

```typescript
// user.api.test.ts
import { describe, it, expect, vi } from 'vitest';
import { userApi } from './user.api';
import { api } from '../../../core/api/axiosInstance';

vi.mock('../../../core/api/axiosInstance');

describe('userApi', () => {
  it('fetches users', async () => {
    const mock = { data: [{ id: 1, firstName: 'Alice', email: 'alice@test.com' }], totalCount: 1 };
    (api.get as any).mockResolvedValue({ data: mock });

    const result = await userApi.getAll();
    expect(result).toEqual(mock);
  });
});
```

### Component Testing Rules

- Test **behavior**, not implementation — test what the user sees, not which functions were called.
- Use `screen.getByText()`, `screen.getByRole()` from React Testing Library, not internal component state.
- Mock API modules with `vi.mock()`, or mock HTTP responses with MSW for integration-style tests.

```tsx
// UserCard.test.tsx
import { render, screen } from '@testing-library/react';
import { UserCard } from './UserCard';

it('renders the user name', () => {
  render(<UserCard user={{ id: 1, firstName: 'Alice', lastName: 'Smith' } as User} onDelete={() => {}} />);
  expect(screen.getByText('Alice Smith')).toBeInTheDocument();
});
```

### Coverage Targets — Identical

| Layer | Minimum Coverage |
|-------|-----------------|
| API modules / business logic | 80% line coverage |
| Route guards / auth store | 90% line coverage |
| Utilities / pure functions | 95% line coverage |
| Components | 60% — focus on critical paths |

---

## 14. Code Style & Naming Conventions

### Tooling

- **ESLint** with `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `@typescript-eslint`.
- **Prettier** — enforce consistent formatting, configured per project.
- **Husky + lint-staged** — run linting on staged files before every commit.

```json
// .prettierrc
{
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "semi": true
}
```

### Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Component | PascalCase | `UserCard`, `DashboardPage` |
| Hook | camelCase, `use` prefix | `useAuth`, `useDebounce` |
| Zustand store hook | `useXStore` | `useCartStore`, `useAuthStore` |
| Interface / Type | PascalCase | `User`, `CreateUserDto`, `PagedResponse<T>` |
| Enum | PascalCase name, `SCREAMING_SNAKE` values | `UserStatus.ACTIVE` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS` |
| Functions & variables | camelCase | `getUser()`, `isLoading` |
| Props interface | `ComponentNameProps` | `UserCardProps` |
| Tailwind classes | utility-first, no BEM needed | `className="flex items-center gap-2"` |

### Import Order

Group imports with a blank line between each group:

1. React core (`react`, `react-dom`)
2. Third-party libraries (`react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, etc.)
3. App core (`@/core/...` or `../../core/...`)
4. Feature-relative (`./hooks/...`, `../types/...`)

---

## 15. Security Standards

### XSS Prevention

- React **auto-escapes all JSX expressions by default** — `{userInput}` is always safe.
- **Never use `dangerouslySetInnerHTML`** with user-provided data.
- If HTML rendering is genuinely required (e.g., rich text from a CMS), sanitize with
  **DOMPurify** before passing to `dangerouslySetInnerHTML`, and only for known-safe,
  admin-controlled content.

```tsx
// ❌ WRONG — unsanitized user content
<div dangerouslySetInnerHTML={{ __html: comment.body }} />

// ✅ CORRECT — sanitized, admin-controlled content only
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cmsContent) }} />
```

### CSRF Protection

If the backend uses cookie-based CSRF tokens, configure Axios with `withCredentials: true`
and read the CSRF token header/cookie pattern your backend expects (e.g., `X-XSRF-TOKEN`).

### Content Security Policy

- Configure a strict CSP header on the server. React apps built with Vite should not
  require `unsafe-inline` or `unsafe-eval` in production.
- No dynamic code evaluation: no `new Function()`, no `eval()`.

### Dependency Security

- Run `npm audit` before every release.
- Use Dependabot or Renovate to keep dependencies updated.
- Review weekly downloads, maintainer activity, and audit status before installing any new package.

---

## 16. Environment & Configuration Management

### Environment Files — Vite

Vite exposes env variables prefixed with `VITE_` via `import.meta.env`.

```bash
# .env (development)
VITE_API_URL=http://localhost:3000/api

# .env.production
VITE_API_URL=https://api.myapp.com/api
```

```typescript
// Access anywhere
const apiUrl = import.meta.env.VITE_API_URL;
```

### Feature Flags

Feature flags live in env files or a remote config endpoint. Access them via a
`useFeatureFlags` hook — **never read `import.meta.env` directly inside components**.

```typescript
// core/config/useFeatureFlags.ts
interface FeatureFlags {
  newDashboard: boolean;
}

export function useFeatureFlags(): FeatureFlags {
  return {
    newDashboard: import.meta.env.VITE_FEATURE_NEW_DASHBOARD === 'true',
  };
}
```

### Secrets

> **Never put API keys, secrets, or credentials in `.env` files committed to the repo.**
> Any variable prefixed `VITE_` is bundled into the client-side JavaScript and is fully
> visible to end users. Secrets belong on the backend only.

---

## 17. Quick Reference: Decision Matrix

| Decision | Answer |
|----------|--------|
| Class or function components? | **Function components always** — except the global Error Boundary (React requirement) |
| Where do separate template/style files go? | **Nowhere** — JSX + Tailwind classes live in the same `.tsx` file |
| Where do HTTP calls go? | **API module — never directly in a component** |
| Local state? | **`useState` / `useReducer`** |
| Global client state? | **Zustand** |
| Server state / data fetching? | **TanStack Query** — `useQuery` / `useMutation` |
| Event streams (debounce, etc.)? | **Custom hook** (`useDebounce`, `useEffect`) |
| Forms? | **React Hook Form + Zod** — always, except trivial single-field |
| Routing library? | **React Router v6** (`createBrowserRouter`) |
| Route guards? | **Wrapper components** (`<ProtectedRoute>`) rendering `<Outlet />` or `<Navigate />` |
| Lazy loading? | **Yes — every feature route, no exceptions** |
| Memoization? | **`React.memo` / `useMemo` / `useCallback`** — on components/values that re-render often |
| List keys? | **Stable `item.id`** — never array index for reorderable lists |
| External state library beyond Zustand? | **No** — escalate to Redux Toolkit only if truly needed |
| Access token storage? | **Memory only** — Zustand store, never persisted |
| Refresh token storage? | **`localStorage`** |
| CSS framework? | **Tailwind CSS** — no plain CSS for component styles |
| Save button color? | **Green** — `bg-green-600 hover:bg-green-700` |
| Update/Edit button color? | **Amber** — `bg-amber-500 hover:bg-amber-600` |
| Delete button color? | **Red** — `bg-red-600 hover:bg-red-700` |
| Cancel button color? | **Gray** — `bg-gray-100 hover:bg-gray-200 text-gray-700` |
| Tables need pagination? | **Yes — always.** Default 10 rows. `page`/`pageSize` in URL via `useSearchParams`. |
| Table with search/filter? | **`POST /search`** with `{ query, paging: { pageNumber, pageSize }, sorting: { field, sortOrder } }` |
| Test runner? | **Vitest** for unit/component, **Playwright** for E2E |
| HTML sanitization? | **DOMPurify** before any `dangerouslySetInnerHTML` |
