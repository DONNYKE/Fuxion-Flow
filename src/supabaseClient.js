import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zhfyokxtcdpshjbptusn.supabase.co'; const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZnlva3h0Y2Rwc2hqYnB0dXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODk4MjYsImV4cCI6MjA2OTY2NTgyNn0.dPeIuo3s7DasHkENDvMvGsxjOxJ1ucdusVYBP4pWIp4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);