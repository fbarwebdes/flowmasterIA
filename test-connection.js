import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Carrega .env.local manualmente para o teste
// Precisamos filtrar o arquivo para pegar as variáveis
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas no .env.local");
    process.exit(1);
}

console.log(`Testing connection to: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Tenta fazer uma query simples na auth (verificar sessão ou health)
        // Como anon key não lista usuários, vamos tentar um signUp fake que deve falhar ou funcionar, 
        // mas o melhor é checar se o serviço responde.

        const { data, error } = await supabase.from('does_not_exist').select('*').limit(1);

        // Se der erro 404 ou 42P01 (table not found), significa que CONECTOU no banco, apenas a tabela não existe.
        // Se der erro de conexão (network), falhou.

        if (error && error.code === '42P01') {
            console.log("✅ Conexão com Supabase estabelecida com sucesso! (Erro esperado: tabela não existe)");
        } else if (error) {
            console.log("⚠️ Conexão respondeu, mas com erro:", error.message, error.code);
            if (error.message.includes('fetch failed')) {
                console.error("❌ Falha de rede. Verifique sua internet ou firewall.");
            } else {
                console.log("✅ Parecer haver conectividade com o serviço.");
            }
        } else {
            console.log("✅ Conexão bem sucedida!");
        }

        // Test Auth
        const { error: authError } = await supabase.auth.getSession();
        if (authError) {
            console.error("❌ Erro no serviço de Auth:", authError.message);
        } else {
            console.log("✅ Serviço de Autenticação respondendo.");
        }

    } catch (e) {
        console.error("❌ Exceção ao conectar:", e);
    }
}

testConnection();
