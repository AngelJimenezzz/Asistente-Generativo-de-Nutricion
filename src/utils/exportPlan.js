import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// SDK 54+ movió writeAsStringAsync/EncodingType a la API "legacy" — la nueva
// API (File/Directory) no tiene un equivalente directo de "escribir base64 a
// una ruta" todavía tan simple. La legacy sigue soportada oficialmente.
// Nota: ninguna de las dos existe en web — por eso todo lo que toca
// expo-file-system/expo-print/expo-sharing va detrás de un check de Platform.
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml(days, userName) {
  const dayBlocks = days
    .map((day) => {
      const mealsHtml = day.meals
        .map(
          (meal) => `
            <div class="meal">
              <div class="meal-name">${escapeHtml(meal.name)}</div>
              <ul>${meal.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
              <p class="why">${escapeHtml(meal.why)}</p>
            </div>`
        )
        .join('');
      return `
        <div class="day">
          <h2>${escapeHtml(day.dayOfWeek || `Día ${day.dayIndex}`)}</h2>
          <p class="macros">${day.calories} kcal · ${day.macros.protein}g proteína · ${day.macros.carbs}g carbohidratos · ${day.macros.fat}g grasa</p>
          ${mealsHtml}
        </div>`;
    })
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1F2A24; padding: 24px; }
          h1 { color: #2F6F4E; font-size: 22px; margin-bottom: 4px; }
          .subtitle { color: #6B7A72; font-size: 12px; margin-bottom: 24px; }
          .day { margin-bottom: 24px; page-break-inside: avoid; }
          h2 { color: #2F6F4E; font-size: 16px; border-bottom: 1px solid #E3E8E5; padding-bottom: 4px; }
          .macros { font-size: 12px; color: #6B7A72; margin: 4px 0 12px; }
          .meal { margin-bottom: 10px; }
          .meal-name { font-weight: 700; font-size: 13px; }
          ul { margin: 2px 0; padding-left: 18px; font-size: 13px; }
          .why { font-size: 11px; color: #6B7A72; font-style: italic; margin: 2px 0 0; }
          .disclaimer { margin-top: 24px; font-size: 10px; color: #6B7A72; }
        </style>
      </head>
      <body>
        <h1>Plan de alimentación semanal</h1>
        <p class="subtitle">${escapeHtml(userName)} · generado el ${new Date().toLocaleDateString('es-MX')}</p>
        ${dayBlocks}
        <p class="disclaimer">Esta aplicación es una herramienta de apoyo y no sustituye la consulta con un profesional de la salud.</p>
      </body>
    </html>`;
}

// Construye el PDF directamente con jsPDF (en vez de HTML + diálogo de
// impresión del navegador) para que en web se pueda descargar como archivo
// real, igual que el Excel — abrir el diálogo de impresión y esperar a que
// el usuario elija "Guardar como PDF" no es lo mismo que descargar un .pdf.
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function buildPdfDoc(days, userName) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  const ensureSpace = (needed) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setTextColor(47, 111, 78);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('Plan de alimentación semanal', MARGIN, y);
  y += 7;

  doc.setTextColor(107, 122, 114);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`${userName} · generado el ${new Date().toLocaleDateString('es-MX')}`, MARGIN, y);
  y += 10;

  days.forEach((day) => {
    ensureSpace(14);
    doc.setTextColor(47, 111, 78);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(day.dayOfWeek || `Día ${day.dayIndex}`, MARGIN, y);
    y += 6;

    doc.setTextColor(107, 122, 114);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(
      `${day.calories} kcal · ${day.macros.protein}g proteína · ${day.macros.carbs}g carbohidratos · ${day.macros.fat}g grasa`,
      MARGIN,
      y
    );
    y += 7;

    day.meals.forEach((meal) => {
      ensureSpace(10);
      doc.setTextColor(31, 42, 36);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(meal.name, MARGIN, y);
      y += 5;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      meal.items.forEach((item) => {
        const lines = doc.splitTextToSize(`• ${item}`, CONTENT_WIDTH - 2);
        ensureSpace(lines.length * 4.2);
        doc.text(lines, MARGIN + 2, y);
        y += lines.length * 4.2;
      });

      doc.setTextColor(107, 122, 114);
      doc.setFont(undefined, 'italic');
      const whyLines = doc.splitTextToSize(meal.why, CONTENT_WIDTH - 2);
      ensureSpace(whyLines.length * 4);
      doc.text(whyLines, MARGIN + 2, y);
      y += whyLines.length * 4 + 4;
    });

    y += 3;
  });

  ensureSpace(10);
  doc.setTextColor(107, 122, 114);
  doc.setFontSize(8);
  doc.setFont(undefined, 'italic');
  doc.text(
    'Esta aplicación es una herramienta de apoyo y no sustituye la consulta con un profesional de la salud.',
    MARGIN,
    y
  );

  return doc;
}

export async function exportPlanAsPdf(days, userName) {
  if (Platform.OS === 'web') {
    const doc = buildPdfDoc(days, userName);
    doc.save(`plan-${userName.replace(/\s+/g, '_')}.pdf`);
    return null;
  }

  const html = buildHtml(days, userName);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Plan de alimentación' });
  }
  return uri;
}

function buildWorkbook(days) {
  const rows = [['Día', 'Comida', 'Alimentos', 'Por qué', 'Calorías del día', 'Proteína (g)', 'Carbohidratos (g)', 'Grasa (g)']];

  days.forEach((day) => {
    day.meals.forEach((meal) => {
      rows.push([
        day.dayOfWeek || `Día ${day.dayIndex}`,
        meal.name,
        meal.items.join(', '),
        meal.why,
        day.calories,
        day.macros.protein,
        day.macros.carbs,
        day.macros.fat,
      ]);
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 50 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 10 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plan semanal');
  return workbook;
}

export async function exportPlanAsExcel(days, userName) {
  const workbook = buildWorkbook(days);
  const fileName = `plan-${userName.replace(/\s+/g, '_')}.xlsx`;

  if (Platform.OS === 'web') {
    // En web no hay FileSystem/Sharing nativos — se genera el archivo en
    // memoria (Blob) y se dispara la descarga con un <a> temporal, el patrón
    // estándar para "descargar archivo" en el navegador.
    const wbArray = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return null;
  }

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Plan de alimentación',
    });
  }
  return fileUri;
}
