#### 节点内容  

```c++
#include "rclcpp/rclcpp.hpp"  //ROS2的客户端库

int main(int argc, char * argv[])
	  // argc 是一个整数 (int)，代表参数的个数 ；argv 是一个字符串数组 (char 类型的指针数组)。 这些字符串就是从命令行传递给程序的**实际参数**。
{
    rclcpp::init(argc, argv);
    auto node = std::make_shared<rclcpp::Node>("cpp_node");  
    //这段代码创建了一个ROS2节点，名称是 "cpp_node"，并且用智能指针 `node` 来管理这个节点
    //std::`是命名空间（namespace）`std` 的作用域限定符，表示“这是标准库里的东西”。
    //make_shared创建指针指针的类是Node 
    RCLCPP_INFO(node->get_logger(), "Hello, ROS2 from C++17!");
    rclcpp::spin(node);
    rclcpp::shutdown();
    return 0;
}
```

不能用 g++ 编译（rclcpp 不在 g++ 的系统默认目录中）  
需要将 rclcpp 添加到目录中

这里用 CmakeLists. Txt 完成

```cmake
cmake_minimum_required(VERSION 3.8)
project(ros2_cpp)

add_executable(ros2_cpp_node ros2_cpp_node.cpp)#用 ros2cppnode.cpp 这个代码文件，帮我生成一个叫做 ros2cppnode 的可执行文件

#添加依赖（查找+包含）
find_package(rclcpp REQUIRED)  #查找对应头文件与库文件（REQUIRED：依赖是必须的）
message(STATUS  ${rclcpp_INCLUDE_DIRS}) #头文件及rclcpp依赖的头文件
message(STATUS  ${rclcpp_LIBRARIES}) #头文件及rclcpp依赖的库文件

target_include_directories(ros2_cpp_node PUBLIC ${rclcpp_INCLUDE_DIRS}) #头文件路径包含（）
target_link_libraries(ros2_cpp_node ${rclcpp_LIBRARIES}) #库文件链接
```

> [!note]-
> “依赖查找”这主要完成以下几件事：
>
> 1.  **`find_package(rclcpp REQUIRED)`**：
>     *   **目的：**  查找并配置 `rclcpp` 包。`rclcpp` 是 ROS 2 中用于 C++ 编程的核心库。
>     *   **`find_package` 命令：**  CMake 的一个内置命令，用于查找外部库或包。它会在系统预定义的位置（比如 `/usr/share/rclcpp/cmake/`）查找 `rclcppConfig.cmake` 或 `rclcpp-config.cmake` 文件。 这些文件包含了关于 `rclcpp` 的信息，例如头文件位置、库文件位置等。
>     *   **`REQUIRED` 关键字：**  指定 `rclcpp` 是一个**必要**的依赖项。 如果找不到 `rclcpp` 包，CMake 将会**报错**并停止配置过程。
> 
> 2.  **`message(STATUS ${rclcpp_INCLUDE_DIRS})`**：
>     *   **目的：**  打印 `rclcpp` 包的头文件目录。
>     *   **`message` 命令：**  CMake 的一个内置命令，用于在控制台中显示消息。`STATUS` 表示这是一个状态消息，通常用于提供构建过程中的信息。
>     *   **`${rclcpp_INCLUDE_DIRS}`：**  这是 `find_package(rclcpp)` 命令设置的一个 CMake 变量。它包含了 `rclcpp` 以及其依赖项的头文件所在的目录列表。 将 `${rclcpp_INCLUDE_DIRS}` 的值打印出来，可以帮助你确认头文件路径是否正确，以及了解 `rclcpp` 依赖的头文件有哪些。
> 
> 3.  **`message(STATUS ${rclcpp_LIBRARIES})`**：
>     *   **目的：**  打印 `rclcpp` 包的库文件。
>     *   **`${rclcpp_LIBRARIES}`：**  这是 `find_package(rclcpp)` 命令设置的另一个 CMake 变量。 它包含了 `rclcpp` 以及其依赖项的库文件的完整路径或库名。将 `${rclcpp_LIBRARIES}` 的值打印出来，可以帮助你确认链接器需要链接哪些库。
> 
> **总结：**
>
> 这段代码的目的是确保你的项目可以找到并使用 ROS 2 的 `rclcpp` 库。  它首先查找 `rclcpp` 包，如果找不到就报错。 然后，它会打印 `rclcpp` 的头文件目录和库文件，方便开发者查看和调试。这些头文件和库文件是构建 ROS 2 C++ 项目所必需的。
>
> **更简单的理解：**
>
> 假设你要用积木搭一个房子，`rclcpp` 就是其中一种特别的积木。
>
> * `find_package(rclcpp REQUIRED)`: 找到这种积木，并且确认一定要找到，不然就没办法继续搭房子了。
> * `message(STATUS ${rclcpp_INCLUDE_DIRS})`: 告诉你这种积木的零件（头文件）放在哪里。
> * `message(STATUS ${rclcpp_LIBRARIES})`: 告诉你这种积木的整体（库文件）是什么，你需要用这些整体才能把积木搭起来。

`cmake .`

> [!note]-
> cmake . 的作用是读取当前目录中的 `CMakeLists.txt` 文件，该文件定义了项目的构建配置，然后生成适合系统的构建文件（如 Makefile 或 Visual Studio 工程文件），以便后续编译项目

`make`

> [!note]-
> 简单来说，make 的作用就是:
>
> 读取 Makefile: 分析项目构建的规则和依赖关系。
> 检查文件时间戳: 确定哪些文件需要重新构建（即源文件被修改后，依赖它的目标文件也需要重新构建）。
> 执行构建命令: 只执行需要执行的构建命令，以生成或更新目标文件。
>
> 想象一下：
>
> 你有很多积木，要用它们拼成一个房子。Makefile 就像拼装说明书，告诉你：
>
> 屋顶需要用到哪些积木。
> 墙壁需要用到哪些积木。
> 如何把屋顶、墙壁、地基组装起来。
> make 就像你，它根据拼装说明书，一步一步地把房子拼好。 如果你后来改动了其中一块积木（比如把地基换成了更结实的积木），make 会发现需要重新拼装地基，并且会更新整个房子，确保它是最新的。

从而，生成节点可执行文件 `ros2_cpp_node`, 命令 `./ros2_cpp_node ` 以运行  

通过 `ros2 node list `, 可以显示该节点  
