import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bogdydsxpvwlvuzjuhci.supabase.co/rest/v1/'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvZ2R5ZHN4cHZ3bHZ1emp1aGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjAxOTksImV4cCI6MjEwNjE5NjE5OX0.HsNSN_yCfsEl4MZgqgwTGFh3_TWORe2IAXHJlfQzH0Q'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
