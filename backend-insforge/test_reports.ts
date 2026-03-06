import { getPendingPaymentsReport } from './src/controllers/reports.controller';

const mockReq = {
    currentUser: { branch_id: '739adc0f-7dd8-4509-9eed-0e1d3c2b2ba0' },
    query: {}
} as any;

const mockRes = {
    json: (data: any) => {
        console.log("\n=== FINAL PENDING DATA ===");
        console.log(JSON.stringify(data, null, 2));
    },
    status: (code: number) => ({
        json: (data: any) => console.log(`Error ${code}:`, data)
    })
} as any;

getPendingPaymentsReport(mockReq, mockRes);
