export type Role = 'platform' | 'owner' | 'receptionist' | 'waiter';
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  restaurant_id: string | null;
}
export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  address: string;
  color: string;
  theme: 'light' | 'dark';
  logo: string;
  wifi_ssid: string;
  wifi_password: string;
  ad_title: string;
  ad_image: string;
  ad_url: string;
  google_review_url: string;
  created_at: number;
}
export interface MenuItem {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  available: number;
  vegetarian: number;
  image: string;
  sort_order: number;
}
export interface DiningTable {
  id: string;
  restaurant_id: string;
  label: string;
  token: string;
  created_at: number;
}
export interface ServiceRequest {
  id: string;
  table_id: string;
  restaurant_id: string;
  status: 'pending' | 'acknowledged' | 'completed';
  created_at: number;
  acknowledged_at: number | null;
  completed_at: number | null;
  assigned_to: string | null;
  table_label: string;
  staff_name: string | null;
}
export interface RestaurantSummary extends Restaurant {
  table_count: number;
  item_count: number;
  open_requests: number;
}
export interface Workspace {
  restaurant: Restaurant;
  tables: DiningTable[];
  menu: MenuItem[];
  staff: User[];
  qrBaseUrl: string;
}
export type PublicRestaurant = Omit<Restaurant, 'wifi_password' | 'wifi_ssid'>;
export interface PublicMenu {
  restaurant: PublicRestaurant;
  table: { label: string } | null;
  menu: MenuItem[];
}
