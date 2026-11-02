import { jsPDF } from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';

const INK: [number, number, number] = [12, 46, 66];
const ATLANTIC: [number, number, number] = [3, 105, 161];
const ICE: [number, number, number] = [240, 249, 255];

/** Shared print layout: selectable text, repeated headers and accurate page totals. */
export class ReportPdf {
  readonly doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  private y = 55;
  private readonly issued = new Date().toLocaleString('es-CL');

  constructor(private title: string, private context: string,
    metrics: { label: string; value: string | number }[] = []) {
    this.doc.setProperties({ title, author: 'TaskTracker', subject: context });
    if (metrics.length) {
      const width = (269 - (metrics.length - 1) * 4) / metrics.length;
      metrics.forEach((metric, index) => {
        const x = 14 + index * (width + 4);
        this.doc.setFillColor(...ICE);
        this.doc.roundedRect(x, 39, width, 24, 2, 2, 'F');
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(18);
        this.doc.setTextColor(...ATLANTIC);
        this.doc.text(String(metric.value), x + 5, 49);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8);
        this.doc.setTextColor(...INK);
        this.doc.text(metric.label, x + 5, 57);
      });
      this.y = 72;
    }
  }

  table(title: string, head: string[], body: (string | number)[][],
    options: UserOptions = {}) {
    const doc = this.doc;
    if (this.y > 167) { doc.addPage(); this.y = 43; }
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, 14, this.y);
    autoTable(doc, {
      theme: 'plain', startY: this.y + 5,
      head: [head], body: body.length ? body : [head.map((_, i) => i ? '' : 'Sin registros')],
      margin: { left: 14, right: 14, top: 42, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 3,
        textColor: INK, overflow: 'linebreak', valign: 'middle', lineWidth: 0 },
      headStyles: { fillColor: ATLANTIC, textColor: 255, fontStyle: 'bold', cellPadding: 3.5 },
      alternateRowStyles: { fillColor: ICE },
      rowPageBreak: 'avoid', showHead: 'everyPage',
      ...options,
    });
    this.y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  finish(): jsPDF {
    const doc = this.doc;
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setFillColor(...INK); doc.rect(0, 0, 297, 32, 'F');
      doc.setFillColor(56, 189, 248); doc.rect(0, 32, 297, 1, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.setTextColor(186, 230, 253); doc.text('TASKTRACKER / GESTIÓN DE PROYECTOS', 14, 9);
      doc.setTextColor(255); doc.setFontSize(18); doc.text(this.title, 14, 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text(doc.splitTextToSize(this.context, 265).slice(0, 1), 14, 27);
      doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2); doc.line(14, 196, 283, 196);
      doc.setTextColor(71, 85, 105); doc.setFontSize(8);
      doc.text(`Generado el ${this.issued}`, 14, 202);
      doc.text(`Página ${page} de ${pages}`, 283, 202, { align: 'right' });
    }
    return doc;
  }
}
