> [!summary]
> 从零创建   
> 
> 包中 `src` 下编写节点  
> 
> **`CMakeLists. txt` 中声明：添加可执行文件，找到并包含头文件库文件，移动可执行文件到 `install` 下**    
> 
> 构建功能包  
> 
> `setup. bash` 补全路径

#### 创建新的功能包  

`ros2 run create --build-type ament_cmake --liscence Apache-2.0 demo_cpp_pkg `  
结果：  ****
![|200](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909191856932.png)  

#### 编写功能包（编写节点与声明）

在 src 下创建节点 `cpp_node.cpp`  
![|250](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909192137077.png)

内容直接用 [[c++节点#节点内容]]

##### 声明  

`cpp_node.cpp` 是通过 CMakeLists. txt 构建的, 在原本基础上添加依赖。添加内容  

```cmake
add_executable (cpp_node src/cpp. node)  

find_package (rclcpp REQUIRED)

ament_target_dependencies(cpp_node rclcpp)
#代替两行代码：
#target_include_directories（cpp_node PUBLIC${rclcpp_INCLUDEDIRS}）#头文件包含
#target Link Libraries（cpp_node ${rclcpp_LIBRARIES}）# 库文件链接
install(
TARGETS cpp_node
DESTINATION lib/${PROJECT_NAME}
)
#把cpp_node 从build目录复制到install/demo_cpp_pkg目录下对应路径。这里是lib/cpp_node_pkg，如图
```

构建功能包后，会创建lib/cpp_node_pkg/cpp_node
![](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909195455417.png)


#### 构建功能包  

`colcon build`  
(构建路径下所有功能包)  
注意，这个命令包含了 cmake . make 的全过程，类似于用高级命令把 c++构建多个节点的过程自动化了。
#### 补全环境变量  

`source install/setup.bash`  

#### 运行功能包下节点  

`ros2 run demo_cpp_pkg cpp_node`  
