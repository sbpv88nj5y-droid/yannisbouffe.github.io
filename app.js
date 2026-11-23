const $ = (selector) => document.querySelector(selector);
const form = $('#mealForm');
const monthFilter = $('#monthFilter');
const mealList = $('#mealList');
const toast = $('#toast');
let receiptData = null;
let meals = [];
let editingMealId = null;
let editReceiptData = null;

const now = new Date();
const toDateInput = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const money = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
const formatDate = (date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
const currentMonth = () => monthFilter.value;

$('#date').value = toDateInput(now);
monthFilter.value = toDateInput(now).slice(0, 7);
$('#todayLabel').textContent = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(now);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('visible'), 2800);
}

function loadMeals() {
  try { meals = JSON.parse(localStorage.getItem('repasChantierMeals') || '[]'); }
  catch { meals = []; }
}
function saveMeals() { localStorage.setItem('repasChantierMeals', JSON.stringify(meals)); }
function setReceipt(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('Choisissez une image de ticket.');
  if (file.size > 4 * 1024 * 1024) return showToast('L’image doit faire moins de 4 Mo.');
  const reader = new FileReader();
  reader.onload = () => {
    receiptData = reader.result;
    $('#previewImage').src = receiptData;
    $('#receiptPreview').hidden = false;
  };
  reader.readAsDataURL(file);
}
function resetReceipt() {
  receiptData = null;
  $('#receiptPreview').hidden = true;
  $('#receiptCamera').value = '';
  $('#receiptFile').value = '';
}
function selectedMeals() { return meals.filter((meal) => meal.date.startsWith(currentMonth())).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt); }
function render() {
  const subset = selectedMeals();
  const total = subset.reduce((sum, meal) => sum + meal.price, 0);
  $('#monthTotal').textContent = money(total);
  $('#monthCount').textContent = subset.length ? `${subset.length} repas enregistré${subset.length > 1 ? 's' : ''}` : 'Aucun repas ajouté';
  mealList.innerHTML = '';
  if (!subset.length) {
    mealList.innerHTML = '<div class="empty-state">Aucun repas pour ce mois.<br>Votre premier ajout apparaîtra ici.</div>';
    return;
  }
  const template = $('#mealTemplate');
  subset.forEach((meal) => {
    const node = template.content.cloneNode(true);
    const date = new Date(`${meal.date}T12:00:00`);
    $('.meal-date strong', node).textContent = date.getDate();
    $('.meal-date span', node).textContent = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', '');
    $('.meal-info h3', node).textContent = meal.site;
    $('.meal-info p', node).textContent = formatDate(meal.date);
    $('.meal-side > strong', node).textContent = money(meal.price);
    const ticket = $('.ticket-link', node);
    if (meal.receipt) { ticket.hidden = false; ticket.addEventListener('click', () => { $('#ticketImage').src = meal.receipt; $('#ticketDialog').showModal(); }); }
    $('.delete-button', node).addEventListener('click', () => {
      if (confirm(`Supprimer le repas du ${formatDate(meal.date)} ?`)) { meals = meals.filter((item) => item.id !== meal.id); saveMeals(); render(); showToast('Repas supprimé.'); }
    });
    mealList.append(node);
  });
}
function renderAllMeals() {
  const list = $('#allMealsList');
  const sorted = meals.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  $('#allMealsCount').textContent = sorted.length ? `${sorted.length} repas enregistré${sorted.length > 1 ? 's' : ''} au total.` : 'Aucun repas enregistré.';
  list.innerHTML = '';
  if (!sorted.length) { list.innerHTML = '<div class="empty-state">Ajoutez votre premier repas depuis l’écran principal.</div>'; return; }
  sorted.forEach((meal) => {
    const row = document.createElement('article'); row.className = 'manage-row';
    const date = document.createElement('time'); date.dateTime = meal.date; date.textContent = formatDate(meal.date);
    const info = document.createElement('div'); const title = document.createElement('h3'); title.textContent = meal.site; const price = document.createElement('p'); price.textContent = money(meal.price); info.append(title, price);
    const actions = document.createElement('div'); actions.className = 'manage-actions';
    const edit = document.createElement('button'); edit.className = 'small-button'; edit.type = 'button'; edit.textContent = 'Modifier'; edit.addEventListener('click', () => openEditMeal(meal.id));
    const remove = document.createElement('button'); remove.className = 'small-button danger'; remove.type = 'button'; remove.textContent = 'Supprimer'; remove.addEventListener('click', () => deleteMealFromManager(meal.id));
    actions.append(edit, remove); row.append(date, info, actions); list.append(row);
  });
}
function deleteMealFromManager(id) {
  const meal = meals.find((item) => item.id === id);
  if (!meal || !confirm(`Supprimer le repas du ${formatDate(meal.date)} ?`)) return;
  meals = meals.filter((item) => item.id !== id); saveMeals(); render(); renderAllMeals(); showToast('Repas supprimé.');
}
function openEditMeal(id) {
  const meal = meals.find((item) => item.id === id); if (!meal) return;
  editingMealId = id; editReceiptData = meal.receipt || null;
  $('#editPrice').value = meal.price.toFixed(2); $('#editDate').value = meal.date; $('#editSite').value = meal.site; $('#editReceiptFile').value = '';
  $('#editTicketStatus').textContent = editReceiptData ? 'Ticket joint' : 'Aucun ticket joint';
  $('#removeEditReceipt').hidden = !editReceiptData;
  $('#editMealDialog').showModal();
}
function setEditReceipt(file) {
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) return showToast('Choisissez une image de moins de 4 Mo.');
  const reader = new FileReader();
  reader.onload = () => { editReceiptData = reader.result; $('#editTicketStatus').textContent = 'Nouveau ticket prêt à enregistrer'; $('#removeEditReceipt').hidden = false; };
  reader.readAsDataURL(file);
}
function csvValue(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function exportMonth() {
  const subset = selectedMeals();
  if (!subset.length) return showToast('Aucun repas à exporter pour ce mois.');
  const rows = [['Date', 'Chantier du matin', 'Prix du menu (€)', 'Ticket joint']];
  subset.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((meal) => rows.push([meal.date, meal.site, meal.price.toFixed(2).replace('.', ','), meal.receipt ? 'Oui' : 'Non']));
  const total = subset.reduce((sum, meal) => sum + meal.price, 0);
  rows.push([]); rows.push(['Total', '', total.toFixed(2).replace('.', ','), '']);
  const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(csvValue).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `repas-chantier-${currentMonth()}.csv` });
  link.click(); URL.revokeObjectURL(link.href); showToast('Export téléchargé pour LibreOffice.');
}
function validMeal(meal) {
  return meal && typeof meal.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meal.date) && typeof meal.site === 'string' &&
    Number.isFinite(meal.price) && (meal.receipt === null || meal.receipt === undefined || typeof meal.receipt === 'string');
}
function downloadFile(content, type, filename) {
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type })), download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}
function createBackup() {
  const backup = { application: 'Repas chantier', version: 1, createdAt: new Date().toISOString(), meals };
  downloadFile(JSON.stringify(backup, null, 2), 'application/json;charset=utf-8', `sauvegarde-repas-chantier-${toDateInput(new Date())}.json`);
  showToast('Sauvegarde complète téléchargée.');
}
function restoreBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showToast('Impossible de lire ce fichier.');
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup || backup.application !== 'Repas chantier' || !Array.isArray(backup.meals) || !backup.meals.every(validMeal)) throw new Error('invalid');
      if (!confirm(`Restaurer ${backup.meals.length} repas ? Les repas actuellement enregistrés seront remplacés.`)) return;
      const previousMeals = meals;
      meals = backup.meals;
      try { saveMeals(); }
      catch { meals = previousMeals; return showToast('La sauvegarde est trop volumineuse pour ce navigateur.'); }
      render(); showToast(`${meals.length} repas restauré${meals.length > 1 ? 's' : ''}.`);
    } catch { showToast('Ce fichier n’est pas une sauvegarde Repas chantier valide.'); }
  };
  reader.readAsText(file);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const price = Number($('#price').value.replace(',', '.'));
  if (!Number.isFinite(price) || price < 0) return showToast('Indiquez un prix valide.');
  meals.push({ id: crypto.randomUUID(), date: $('#date').value, site: $('#site').value.trim(), price, receipt: receiptData, createdAt: Date.now() });
  try { saveMeals(); } catch { meals.pop(); return showToast('Ticket trop volumineux : ajoutez le repas sans photo.'); }
  form.reset(); $('#date').value = toDateInput(new Date()); resetReceipt(); monthFilter.value = $('#date').value.slice(0, 7); render(); showToast('Repas ajouté.');
});
$('#receiptCamera').addEventListener('change', (event) => setReceipt(event.target.files[0]));
$('#receiptFile').addEventListener('change', (event) => setReceipt(event.target.files[0]));
$('#removeReceipt').addEventListener('click', resetReceipt);
monthFilter.addEventListener('change', render);
$('#exportButton').addEventListener('click', exportMonth);
$('#backupButton').addEventListener('click', createBackup);
$('#restoreFile').addEventListener('change', (event) => { restoreBackup(event.target.files[0]); event.target.value = ''; });
$('#closeDialog').addEventListener('click', () => $('#ticketDialog').close());
$('#allMealsButton').addEventListener('click', () => { renderAllMeals(); $('#allMealsDialog').showModal(); });
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
$('#editReceiptFile').addEventListener('change', (event) => setEditReceipt(event.target.files[0]));
$('#removeEditReceipt').addEventListener('click', () => { editReceiptData = null; $('#editTicketStatus').textContent = 'Aucun ticket joint'; $('#removeEditReceipt').hidden = true; $('#editReceiptFile').value = ''; });
$('#editMealForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const meal = meals.find((item) => item.id === editingMealId);
  const price = Number($('#editPrice').value);
  const site = $('#editSite').value.trim();
  if (!meal || !site || !Number.isFinite(price) || price < 0) return showToast('Vérifiez les informations du repas.');
  const previous = { ...meal };
  Object.assign(meal, { date: $('#editDate').value, site, price, receipt: editReceiptData });
  try { saveMeals(); }
  catch { Object.assign(meal, previous); return showToast('Ticket trop volumineux : modification annulée.'); }
  $('#editMealDialog').close(); render(); renderAllMeals(); showToast('Repas modifié.');
});
loadMeals(); render();
