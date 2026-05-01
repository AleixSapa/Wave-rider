import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uleazvxwslhpgneriipt.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gRs0QcH_VlnwhK2vvNNrIg_lPCzYENf';

export const supabase = createClient(supabaseUrl, supabaseKey);
