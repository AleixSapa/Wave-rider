import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uleazvxwslhpgneriipt.supabase.co';
const supabaseKey = 'sb_publishable_gRs0QcH_VlnwhK2vvNNrIg_lPCzYENf';

export const supabase = createClient(supabaseUrl, supabaseKey);
