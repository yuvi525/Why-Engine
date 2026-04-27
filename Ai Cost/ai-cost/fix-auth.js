const { createClient } = require("@supabase/supabase-js");

const url = "https://yawepdmiroplnwdvuoco.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhd2VwZG1pcm9wbG53ZHZ1b2NvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ0ODY4MCwiZXhwIjoyMDkyMDI0NjgwfQ.wuI7Wl_WdfjcZRwEL5iO8bVcoBhZKpIJXt0glCynX3o";

const supabase = createClient(url, key);

async function fixUser() {
  const email = "yuvrajsingh2351@gmail.com";
  console.log(`Searching for user: ${email}`);

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("Failed to list users:", listErr.message);
    return;
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.log(`User ${email} not found. You can safely sign up now!`);
    return;
  }

  console.log(`Found user ${user.id}. Deleting so you can sign up again cleanly...`);
  const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
  
  if (delErr) {
    console.error("Failed to delete user:", delErr.message);
  } else {
    console.log(`Successfully deleted ${email}! You can now go to the Sign Up page and use this email again.`);
  }
}

fixUser();
