// assets/supabase-client.js

// TODO: replace these two with your real values
const SUPABASE_URL = "https://dshqywhkmcmrrunqmtrx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzaHF5d2hrbWNtcnJ1bnFtdHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNDE1MTYsImV4cCI6MjA3OTgxNzUxNn0.6RSQ3SciSJ1cuyfYZSFwbQ08MoZ5nI3Z40TElL0_hkk";

// Supabase JS from the CDN exposes `supabase` globally
const { createClient } = supabase;

// Make a single shared client for the whole site
window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
