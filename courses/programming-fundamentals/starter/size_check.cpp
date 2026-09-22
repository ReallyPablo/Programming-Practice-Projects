#include <iostream>
#include <cstdint>

int main() {
    std::cout << "| `char` / `std::uint8_t` | " << sizeof(std::uint8_t) << " |\n";
    std::cout << "| `std::uint16_t` | " << sizeof(std::uint16_t) << " |\n";
    std::cout << "| `int` / `std::int32_t` | " << sizeof(int) << " |\n";
    std::cout << "| `unsigned` / `std::uint32_t` | " << sizeof(unsigned) << " |\n";
    std::cout << "| `float` | " << sizeof(float) << " |\n";
    std::cout << "| `double` | " << sizeof(double) << " |\n";
    return 0;
}
