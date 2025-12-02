// 1. Вставляємо свої дані з Supabase
const SUPABASE_URL = 'https://bwjyqcibuqxjmvqhckqb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3anlxY2lidXF4am12cWhja3FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjE2NzEsImV4cCI6MjA3OTczNzY3MX0.lEwfrATeBjYtK7iTyNqq6cHhhQcFxLWiuCcF-_NZpko';

// 2. Ініціалізуємо клієнт (перевіряємо, чи бібліотека підключена)
let supabase;

if (typeof supabase === 'undefined') {
    // Створюємо клієнт, якщо бібліотека supabase-js завантажена
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase підключено!");
} else {
    console.error("❌ Бібліотека Supabase не знайдена. Перевір <script> в HTML.");
}

// 3. Функція для перевірки, чи користувач увійшов
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}