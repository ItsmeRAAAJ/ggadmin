```bash
docker compose up --build

# seed the initial data (from backend/)
npm run db:generate
# First time
npx prisma migrate dev --name init
npm run db:seed

# Start frontend/admin panel and app
npm run dev
npm start # For app/mobile

# Upload initial student data:
[CSV](/TEST_DATA/students.csv)


```