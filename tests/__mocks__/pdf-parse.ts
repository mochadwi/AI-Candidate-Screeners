// Mock for pdf-parse library
const mockPDFParse = jest.fn().mockImplementation((buffer: Buffer) => {
  return Promise.resolve({
    text: 'Sample PDF content for testing',
    info: {},
    numpages: 1
  });
});

export default mockPDFParse;