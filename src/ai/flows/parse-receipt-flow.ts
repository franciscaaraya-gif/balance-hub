
'use server';
/**
 * @fileOverview A Genkit flow for parsing receipt images.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseReceiptInputSchema = z.object({
  photoDataUri: z.string().describe("A photo of a receipt as a base64 data URI."),
});
export type ParseReceiptInput = z.infer<typeof ParseReceiptInputSchema>;

const ReceiptItemSchema = z.object({
  name: z.string().describe("The name of the item on the receipt."),
  price: z.number().describe("The unit price or total price of this item line."),
});

const ParseReceiptOutputSchema = z.object({
  items: z.array(ReceiptItemSchema).describe("The list of items extracted from the receipt."),
});
export type ParseReceiptOutput = z.infer<typeof ParseReceiptOutputSchema>;

export async function parseReceipt(input: ParseReceiptInput): Promise<ParseReceiptOutput> {
  return parseReceiptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseReceiptPrompt',
  input: {schema: ParseReceiptInputSchema},
  output: {schema: ParseReceiptOutputSchema},
  prompt: `You are an expert OCR and financial data extractor. 
Analyze the following receipt image and extract a list of all individual items and their prices. 
Focus only on the products/services bought. Ignore taxes, totals, and business info unless they are specific line items.
If an item has multiple units, return the total for that line item as the price.

Photo: {{media url=photoDataUri}}`,
});

const parseReceiptFlow = ai.defineFlow(
  {
    name: 'parseReceiptFlow',
    inputSchema: ParseReceiptInputSchema,
    outputSchema: ParseReceiptOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
