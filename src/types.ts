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
