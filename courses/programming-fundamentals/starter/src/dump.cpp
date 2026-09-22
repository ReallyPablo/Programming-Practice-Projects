// dump.cpp — hex + ASCII, like the Unix tool `hexdump -C`.
//
// The `dump` function below is GIVEN and working, except for one TODO.
// Read it before you change it: it is the shape of nearly every loop you will
// write this semester (an outer loop over rows, an inner loop over columns).
//
// `show_byte` at the bottom is YOUR WORK.
#include "dump.hpp"

#include <iomanip>
#include <iostream>

// How many bytes we print on one line. Try changing it to 8 and rebuilding.
const std::size_t BYTES_PER_LINE = 16;

// Is this byte something a terminal can print as a glyph?
// 0x20 is space, 0x7E is '~'. Everything outside that range we show as '.'.
static bool is_printable(Byte b) { return b >= 0x20 && b <= 0x7E; }

void dump(const Memory& mem) {
    // std::hex switches the stream to hexadecimal; setfill/setw pad with zeros
    // so every number is the same width and the columns line up.
    for (std::size_t row = 0; row < MEM_SIZE; row += BYTES_PER_LINE) {

        // The address column: 0000, 0010, 0020, ...
        std::cout << std::hex << std::setfill('0') << std::setw(4) << row << "  ";

        // The hex column: 16 bytes, two digits each.
        for (std::size_t col = 0; col < BYTES_PER_LINE; ++col) {
            Byte b = mem.data[row + col];
            std::cout << std::setw(2) << static_cast<int>(b) << ' ';
        }

        std::cout << " |";

        // The ASCII gutter.
        for (std::size_t col = 0; col < BYTES_PER_LINE; ++col) {
            Byte b = mem.data[row + col];
        
            if (is_printable(b)) {
                std::cout << static_cast<char>(b);
            } else {
                std::cout << '.';
            }
        }

        std::cout << "|\n";
    }

    // Put the stream back to decimal, or every number you print later is hex.
    std::cout << std::dec << std::setfill(' ');
}

#include "dump.hpp"
#include <iostream>
#include <iomanip>
#include <bitset>

void show_byte(Byte b) {
    // 1. Десятичный формат
    std::cout << static_cast<int>(b) << "  ";

    std::cout << "0x" << std::hex << std::uppercase << std::setfill('0') << std::setw(2) 
              << static_cast<int>(b) << std::dec << "  ";

    // 3. Двоичный формат (0b01000001)
    std::cout << "0b" << std::bitset<8>(b) << "  ";

    // 4. Символьный формат ('A')
    if (b >= 0x20 && b <= 0x7E) {
        std::cout << "'" << static_cast<char>(b) << "'";
    } else {
        std::cout << "'.'";
    }
    std::cout << "\n";
}
