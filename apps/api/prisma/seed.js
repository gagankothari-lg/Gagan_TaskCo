"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding LG Desk database...');
    const existing = await prisma.user.findUnique({
        where: { email: 'admin@leveragedgrowth.co' },
    });
    if (existing) {
        console.log('✓ Super Admin already exists:', existing.empId);
        await prisma.$disconnect();
        return;
    }
    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    const superAdmin = await prisma.user.create({
        data: {
            empId: 'EMP-00001',
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@leveragedgrowth.co',
            passwordHash,
            role: 'Super Admin',
            designation: 'System Administrator',
            team: '1. Management',
            isActive: true,
        },
    });
    console.log('✅ Super Admin created successfully');
    console.log('   EmpId :', superAdmin.empId);
    console.log('   Email :', superAdmin.email);
    console.log('   Pass  : Admin@1234');
    console.log('');
    console.log('⚠️  Change the password after first login!');
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map