import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// SDK 54+ movió writeAsStringAsync/EncodingType a la API "legacy" — la nueva
// API (File/Directory) no tiene un equivalente directo de "escribir base64 a
// una ruta" todavía tan simple. La legacy sigue soportada oficialmente.
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

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

export async function exportPlanAsPdf(days, userName) {
  const html = buildHtml(days, userName);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Plan de alimentación' });
  }
  return uri;
}

export async function exportPlanAsExcel(days, userName) {
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

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileUri = `${FileSystem.cacheDirectory}plan-${userName.replace(/\s+/g, '_')}.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Plan de alimentación',
    });
  }
  return fileUri;
}
