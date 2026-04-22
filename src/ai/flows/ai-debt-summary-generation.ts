'use server';
/**
 * @fileOverview A Genkit flow for summarizing group debts.
 *
 * - generateDebtSummary - A function that generates a financial summary for a debt group.
 * - DebtSummaryInput - The input type for the generateDebtSummary function.
 * - DebtSummaryOutput - The return type for the generateDebtSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema for the AI Debt Summary Generation flow
const DebtSummaryInputSchema = z.object({
  groupName: z.string().describe('The name of the debt group.'),
  members: z.array(z.object({
    id: z.string().describe('The unique ID of the group member.'),
    name: z.string().describe('The display name of the group member.'),
  })).describe('List of all members in the group.'),
  debts: z.array(z.object({
    id: z.string().describe('The unique ID of the debt.'),
    debtorId: z.string().describe('The ID of the group member who owes this debt.'),
    amount: z.number().describe('The amount of money owed for this debt.'),
    description: z.string().optional().describe('A brief description of what the debt is for.'),
    status: z.enum(['pending', 'under_review', 'paid']).describe('The current status of the debt.'),
  })).describe('List of all debts within the group.'),
});
export type DebtSummaryInput = z.infer<typeof DebtSummaryInputSchema>;

// Output Schema for the AI Debt Summary Generation flow
const DebtSummaryOutputSchema = z.object({
  summary: z.string().describe(
    'A concise financial summary for the group, highlighting total outstanding debt, ' +
    'each member\'s individual outstanding contributions (debts), and ' +
    'suggested settlements to balance the accounts. Focus on pending and under_review debts.'
  ),
});
export type DebtSummaryOutput = z.infer<typeof DebtSummaryOutputSchema>;

// Wrapper function to call the Genkit flow
export async function generateDebtSummary(input: DebtSummaryInput): Promise<DebtSummaryOutput> {
  return aiDebtSummaryGenerationFlow(input);
}

// Define the prompt for the AI Debt Summary Generation
const debtSummaryPrompt = ai.definePrompt({
  name: 'debtSummaryPrompt',
  input: {schema: DebtSummaryInputSchema},
  output: {schema: DebtSummaryOutputSchema},
  prompt: `You are an expert financial analyst specializing in group debt management. Your task is to analyze the provided debt information for the group named "{{{groupName}}}" and generate a concise financial summary.

Here are the members in the group:
{{#each members}}
- Member ID: {{{id}}}, Name: {{{name}}}
{{/each}}

Here are the debts. Only consider debts with 'pending' or 'under_review' status for calculations.
{{#each debts}}
- Debt ID: {{{id}}}, Debtor ID: {{{debtorId}}}, Amount: {{{amount}}}, Description: "{{{description}}}", Status: {{{status}}}
{{/each}}

Please provide a summary that includes:
1.  **Total Outstanding Debt**: Calculate the sum of all 'pending' and 'under_review' debt amounts.
2.  **Individual Outstanding Contributions/Debts**: For each member, list their total outstanding debt. Use the member names provided in the members list. If a member has no outstanding debt (pending or under_review), clearly state that.
3.  **Suggested Settlements**: Based on the individual outstanding debts, provide clear, actionable suggestions on how members can settle their debts to balance the group's finances. Aim to minimize the number of transactions required for settlement if possible.

Ensure the summary is clear, concise, and easy to understand for a group administrator.`,
});

// Define the Genkit flow
const aiDebtSummaryGenerationFlow = ai.defineFlow(
  {
    name: 'aiDebtSummaryGenerationFlow',
    inputSchema: DebtSummaryInputSchema,
    outputSchema: DebtSummaryOutputSchema,
  },
  async (input) => {
    // Call the prompt with the input data
    const {output} = await debtSummaryPrompt(input);
    // The prompt is configured to directly output the DebtSummaryOutputSchema, so we can return its output.
    return output!;
  }
);
