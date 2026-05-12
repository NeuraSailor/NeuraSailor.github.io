> [!summary]
> 从零创建  
> 
> 包中 `__init__  ` 同级编写节点  
> 
> `setup. py ` 中声明，指向 main 函数   
> 
> 构建功能包，只剩 install   
> 
> `setup. bash` 补全路径
>  

#### 创建新的功能包  

`ros2 pkg create demo_python_pkg --build-type ament_python --license Apache-2.0`  

> [!note]-
> 使用 ROS 2 命令行工具，创建一个名为 demo_python_pkg 的 Python 软件包，使用 ament_python 构建系统进行构建，并采用 Apache-2.0 许可协议。
![](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909121952000.png)
⚠️upload failed, check dev console
⚠️upload failed, check dev console
⚠️upload failed, check dev console

创建完成，生成文件如图：

![|250](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909151703489.png)  

#### 编写功能包  

##### 创建节点 `python_node.py`

![|375](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909153643924.png)

内容如下：

 ```python
import rclpy  
from rclpy.node import Node  

def main():  
    rclpy.init()    
    node = Node('python_node')    #节点名：python_node
    node.get_logger().info('Hello from Python ROS2 Node!')  #日志打印
    node.get_logger().warn('This is a warning message.')  
    rclpy.spin(node)  #ROS2启动，持续运行
    rclpy.shutdown()  
#不运行main函数，因为ros2构建会生成可执行文件调用main()
```

##### 声明  

在 setup. Py 中声明  
![|725](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909154500438.png)

' 节点名 = 功能包名. 节点名. 函数名 '

在功能包清单文件 package. Xml 中添加依赖 (非必要)

![|725](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909155049638.png)

功能包依赖 rclpy

#### 构建功能包  

`colcon build`

> [!note]-
> `colcon build` 命令是 **Colcon 构建工具** 的主要命令，用于**编译和构建你的 ROS (机器人操作系统) 或者其他基于 CMake 的项目**。
>
> 简单来说，它做以下事情：
>
> * **找到你的所有软件包 (package):**  Colcon 会扫描你的工作空间，寻找包含 `CMakeLists.txt` 的文件夹，这些文件夹被认为是软件包。
> * **解决依赖关系:** 它会分析你的软件包之间的依赖关系，确保按照正确的顺序构建它们。
> * **编译代码:**  它会使用 CMake 和你的编译器 (例如 GCC 或者 Clang) 来编译你的 C++, Python 或其他语言的代码。
> * **安装文件:**  它会将编译后的文件 (例如可执行文件、库、Python 模块) 安装到你指定的位置。
> 
> **总结:**
>
> `colcon build` 就是 **构建和安装你所有 ROS 项目中的代码**，让它们可以运行。 类似与 `make` 命令，但更强大，能够处理复杂的项目结构和依赖关系。
>
> **举个例子:**
>
> 假设你有一个 ROS 工作空间，里面有两个软件包 `package_A` 和 `package_B`， 并且 `package_B` 依赖于 `package_A`。 运行 `colcon build` 后， Colcon 会先构建 `package_A`， 然后构建 `package_B`， 确保它们都正确编译和安装。

Python 中只是对文件拷贝并加上一层包装  
新生成 3 个文件夹 build (构建过程中间文件)/install（构建结果文件夹）/log

![1757404332138_d.png|300](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909155400994.png)

**注意注意，进行到这里，install 文件为最终单独有用的文件**  把 install 文件复制给别人，别人就可以直接运行功能包了  
Install 文件内部：  
![1757405100466_d.png|300](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909160503404.png)

可执行文件 python_node 中运行的 main () 函数为 install 文件夹下 python_node. py 中的 main 函数，而非构建功能包前 demo_python_pkg 下的  中的 main 函数  

#### 补全环境变量路径  

目前运行可执行文件无法运行，找不到 main () 函数所在文件 `python_node.py` 上一层级的包 `demo_pyhon_package`, 需要自主添加路径

Python 功能包根据环境变量 PYTHONPATH 找包，故在 PYTHONPATH 上增加路径  

##### 手动添加

命令：`export PATHONPATH =  /home/wzy/chapt2/install/demo_python_pkg/lib/python3.10/site-package:$PYTHONPATH`

##### 自动添加  

命令：`source install/setup.bash  `, 自动添加环境变量 PATHONPATH 路径

#### 运行功能包中节点

`ros2 run demo_python_package python_node`  
