export interface InventoryItem {
  id?: number;
  date: string;
  number: string;
  amount: number; // เปลี่ยนจาก items เป็น amount
  warehouse: string;
  supplier: string;
  bookedOn: string;
  bookedBy: string;
  sent: boolean;
  description: string;
}
// Add these definitions in your types.d.ts or directly in your relevant files
interface CartItem {
  product: {
    id: number;
    price: number;
  };
  quantity: number;
}

interface User {
  id: number;
  username: string;
}
