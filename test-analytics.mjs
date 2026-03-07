import fs from 'fs';

async function testEdgeFunction() {
    try {
        const envFile = fs.readFileSync('.env.local', 'utf-8') + '\n' + fs.readFileSync('.env', 'utf-8');
        const urlMatch = envFile.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);
        const keyMatch = envFile.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

        if (!urlMatch || !keyMatch) {
            console.error("Could not find Supabase URL/KEY");
            return;
        }

        const supabaseUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
        const anonKey = keyMatch[1].trim().replace(/^["']|["']$/g, '');
        const functionUrl = `${supabaseUrl}/functions/v1/analytics`;
        console.log(`Fetching from: ${functionUrl}`);

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`
            }
        });

        const text = await response.text();
        console.log(`Response Status: ${response.status}`);
        console.log(`Response Body: ${text}`);

    } catch (err) {
        console.error("Script error:", err);
    }
}

testEdgeFunction();
