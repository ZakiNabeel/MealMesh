/**
 * Client-side grocery-list PDF export (Pro feature). Pure jsPDF — no native
 * module, no server round-trip, so it works on the only live surface (web).
 */

import { jsPDF } from 'jspdf';

import { localizeName } from '@/lib/cuisine';
import type { GroceryItem, Region } from '@/types';

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function groupByCategory(items: GroceryItem[]): [string, GroceryItem[]][] {
  const map = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const arr = map.get(item.category) ?? [];
    arr.push(item);
    map.set(item.category, arr);
  }
  return [...map.entries()];
}

/** Builds the grocery list as a PDF and returns it as a Blob, ready to download or share. */
export function buildGroceryPdf(grocery: GroceryItem[], region: Region, householdName: string): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Grocery list', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(110, 110, 110);
  doc.text(`${householdName} · this week`, marginX, y);
  doc.setTextColor(20, 20, 20);
  y += 28;

  for (const [category, items] of groupByCategory(grocery)) {
    if (y > 760) {
      doc.addPage();
      y = 56;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(category, marginX, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    for (const item of items) {
      if (y > 780) {
        doc.addPage();
        y = 56;
      }
      const name = cap(localizeName(item.name, region));
      doc.text(`• ${name}`, marginX + 6, y);
      if (item.quantity) {
        doc.text(item.quantity, 500, y, { align: 'right' });
      }
      y += 18;
    }
    y += 10;
  }

  return doc.output('blob');
}

export function groceryPdfFileName(householdName: string): string {
  const slug = householdName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'household';
  return `${slug}-grocery-list.pdf`;
}

/** Triggers a browser download of the blob — the only path guaranteed to work everywhere on web. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Hands the PDF to the OS share sheet (so WhatsApp/Gmail can appear as targets)
 * where the Web Share API with file support exists — Android/iOS browsers,
 * mostly. Falls back to a plain download everywhere else (most desktop
 * browsers): there is no way to push a file into WhatsApp/Gmail from a
 * webpage without that API.
 */
export async function shareOrDownloadGroceryPdf(
  blob: Blob,
  fileName: string,
): Promise<{ shared: boolean }> {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const canShareFiles = Boolean(nav?.canShare && nav.canShare({ files: [file] }));

  if (canShareFiles && nav?.share) {
    try {
      await nav.share({ files: [file], title: 'Grocery list' });
      return { shared: true };
    } catch {
      // User cancelled the share sheet, or it failed — fall through to download.
    }
  }

  downloadBlob(blob, fileName);
  return { shared: false };
}
