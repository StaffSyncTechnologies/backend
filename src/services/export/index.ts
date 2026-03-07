import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface WorkerExportData {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  createdAt: Date;
  workerProfile?: {
    rtwStatus?: string | null;
    hourlyRate?: unknown;
    niNumber?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  } | null;
  workerSkills?: Array<{
    skill: { name: string };
  }>;
  reliabilityScore?: {
    score: number;
    totalShifts: number;
    completedShifts: number;
  } | null;
  [key: string]: unknown;
}

export class ExportService {
  /**
   * Export workers to Excel
   */
  static async exportWorkersToExcel(
    res: Response,
    workers: WorkerExportData[],
    organizationName: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'StaffSync';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Workers');

    // Define columns
    worksheet.columns = [
      { header: 'Name', key: 'fullName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'RTW Status', key: 'rtwStatus', width: 15 },
      { header: 'Hourly Rate', key: 'hourlyRate', width: 12 },
      { header: 'NI Number', key: 'niNumber', width: 15 },
      { header: 'Skills', key: 'skills', width: 30 },
      { header: 'Reliability', key: 'reliability', width: 12 },
      { header: 'Total Shifts', key: 'totalShifts', width: 12 },
      { header: 'Joined', key: 'joinedAt', width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    workers.forEach(worker => {
      const skills = worker.workerSkills?.map(ws => ws.skill.name).join(', ') || '';
      const reliability = worker.reliabilityScore?.score
        ? `${Math.round(worker.reliabilityScore.score)}%`
        : 'N/A';

      worksheet.addRow({
        fullName: worker.fullName,
        email: worker.email,
        phone: worker.phone || '',
        status: worker.status,
        rtwStatus: worker.workerProfile?.rtwStatus || 'PENDING',
        hourlyRate: worker.workerProfile?.hourlyRate
          ? `£${Number(worker.workerProfile.hourlyRate).toFixed(2)}`
          : '',
        niNumber: worker.workerProfile?.niNumber || '',
        skills,
        reliability,
        totalShifts: worker.reliabilityScore?.totalShifts || 0,
        joinedAt: worker.createdAt.toLocaleDateString('en-GB'),
      });
    });

    // Add alternating row colors
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
      }
    });

    // Set response headers
    const filename = `workers_${organizationName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Export workers to PDF
   */
  static async exportWorkersToPDF(
    res: Response,
    workers: WorkerExportData[],
    organizationName: string
  ): Promise<void> {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    const filename = `workers_${organizationName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Worker List', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(organizationName, { align: 'center' });
    doc.fontSize(8).text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
    doc.moveDown(1.5);

    // Table configuration
    const startX = 40;
    let currentY = doc.y;
    const rowHeight = 25;
    const colWidths = [120, 150, 90, 70, 80, 70, 100, 60];
    const headers = ['Name', 'Email', 'Phone', 'Status', 'RTW', 'Rate', 'Skills', 'Reliability'];

    // Draw table header
    doc.font('Helvetica-Bold').fontSize(9);
    doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#4472C4');
    doc.fillColor('#FFFFFF');
    
    let x = startX + 5;
    headers.forEach((header, i) => {
      doc.text(header, x, currentY + 8, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });

    currentY += rowHeight;
    doc.fillColor('#000000').font('Helvetica').fontSize(8);

    // Draw table rows
    workers.forEach((worker, index) => {
      // Check if need new page
      if (currentY > doc.page.height - 60) {
        doc.addPage({ layout: 'landscape' });
        currentY = 40;
        
        // Redraw header on new page
        doc.font('Helvetica-Bold').fontSize(9);
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#4472C4');
        doc.fillColor('#FFFFFF');
        
        x = startX + 5;
        headers.forEach((header, i) => {
          doc.text(header, x, currentY + 8, { width: colWidths[i] - 10 });
          x += colWidths[i];
        });
        
        currentY += rowHeight;
        doc.fillColor('#000000').font('Helvetica').fontSize(8);
      }

      // Alternating row background
      if (index % 2 === 0) {
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#F2F2F2');
        doc.fillColor('#000000');
      }

      const skills = worker.workerSkills?.map(ws => ws.skill.name).slice(0, 2).join(', ') || '-';
      const reliability = worker.reliabilityScore?.score
        ? `${Math.round(worker.reliabilityScore.score)}%`
        : '-';

      const rowData = [
        worker.fullName,
        worker.email,
        worker.phone || '-',
        worker.status,
        worker.workerProfile?.rtwStatus || 'PENDING',
        worker.workerProfile?.hourlyRate ? `£${Number(worker.workerProfile.hourlyRate).toFixed(2)}` : '-',
        skills,
        reliability,
      ];

      x = startX + 5;
      rowData.forEach((cell, i) => {
        doc.text(String(cell).substring(0, 25), x, currentY + 8, { 
          width: colWidths[i] - 10,
          ellipsis: true,
        });
        x += colWidths[i];
      });

      currentY += rowHeight;
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).text(`Total Workers: ${workers.length}`, startX);

    doc.end();
  }
}
