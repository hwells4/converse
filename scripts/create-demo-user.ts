import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { users } from '../shared/schema';
import bcrypt from 'bcrypt';

async function createDemoUser() {
  try {
    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Create database connection
    const sql = neon(databaseUrl);
    const db = drizzle(sql);

    // Demo user details
    const demoUser = {
      username: 'demo',
      email: 'demo@converseai.com',
      password: 'ConverseDemo2024!',
    };

    console.log('Creating demo user...');
    console.log(`Username: ${demoUser.username}`);
    console.log(`Email: ${demoUser.email}`);
    console.log(`Password: ${demoUser.password}`);

    // Hash the password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(demoUser.password, saltRounds);

    // Check if user already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, demoUser.username))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('❌ Demo user already exists!');
      return;
    }

    // Create the demo user
    const newUser = await db
      .insert(users)
      .values({
        username: demoUser.username,
        email: demoUser.email,
        passwordHash,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    console.log('✅ Demo user created successfully!');
    console.log('User details:', newUser[0]);
    console.log('');
    console.log('🔑 Login credentials:');
    console.log(`   Username: ${demoUser.username}`);
    console.log(`   Password: ${demoUser.password}`);
    console.log('');
    console.log('🌐 You can now sign in at: http://localhost:5000/sign-in');

  } catch (error) {
    console.error('❌ Error creating demo user:', error);
    process.exit(1);
  }
}

// Import eq function
import { eq } from 'drizzle-orm';

// Run the script
createDemoUser();